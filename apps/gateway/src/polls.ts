import { and, eq, getDb, pollVotes, polls } from "@handsup/db";
import { keyedThrottle } from "@handsup/server";
import {
  RATING_OPTIONS,
  rk,
  votePayload,
  votePayloadFor,
  type PollChoice,
  type PollKind,
  type PollResults,
  type PollView,
  type TeacherAck,
  type VoteAck,
} from "@handsup/shared";
import { env } from "./env";
import { hub, sessionRoom } from "./hub";
import { redis } from "./redis";
import { getSessionById } from "./sessions";

const db = getDb(env.databaseUrl);

function toView(p: typeof polls.$inferSelect): PollView {
  return {
    id: p.id,
    question: p.question,
    kind: p.kind,
    options: p.kind === "rating" ? RATING_OPTIONS : p.options,
    openedAt: p.openedAt?.getTime() ?? null,
    closedAt: p.closedAt?.getTime() ?? null,
  };
}

/** Option indexes a choice counts towards (a rating of 4 counts towards index 3). */
function indexes(kind: PollKind, choice: PollChoice): number[] {
  if (kind === "rating") return [Number(choice) - 1];
  return Array.isArray(choice) ? choice : [choice];
}

export async function getActivePoll(sid: string): Promise<PollView | null> {
  const raw = await redis.get(rk.activePoll(sid));
  return raw ? (JSON.parse(raw) as PollView) : null;
}

export async function pollResults(sid: string, poll: PollView): Promise<PollResults> {
  const h = await redis.hgetall(rk.poll(sid, poll.id));
  return { pollId: poll.id, counts: poll.options.map((_, i) => Number(h[i] ?? 0)), voters: Number(h._voters ?? 0) };
}

/** Rebuilds a poll's Redis counters from the database (used when a poll is launched or relaunched). */
async function rebuildCounts(sid: string, poll: PollView) {
  const votes = await db.select({ choice: pollVotes.choice }).from(pollVotes).where(eq(pollVotes.pollId, poll.id));
  const key = rk.poll(sid, poll.id);
  const p = redis.multi().del(key);
  if (votes.length) {
    p.hset(key, "_voters", votes.length);
    for (const v of votes) for (const i of indexes(poll.kind, v.choice as PollChoice)) p.hincrby(key, String(i), 1);
  }
  p.expire(key, 7 * 24 * 3600);
  await p.exec();
}

/** Live results: teacher always, students only if the teacher allowed "See poll results". At most 2 per second. */
const broadcastResults = keyedThrottle(500, async (sid) => {
  const poll = await getActivePoll(sid);
  if (!poll) return;
  const results = await pollResults(sid, poll);
  hub.teachers.to(sessionRoom(sid)).emit("poll:results", results);
  const session = await getSessionById(sid);
  if (session?.inputs.pollResults) hub.students.to(sessionRoom(sid)).emit("poll:results", results);
});

export async function launchPoll(sid: string, pollId: string): Promise<TeacherAck> {
  const row = await db.query.polls.findFirst({ where: and(eq(polls.id, pollId), eq(polls.sessionId, sid)) });
  if (!row) return { ok: false, reason: "not_found" };
  const current = await getActivePoll(sid);
  if (current && current.id !== pollId) await closePoll(sid, current.id);

  const [updated] = await db.update(polls).set({ openedAt: new Date(), closedAt: null }).where(eq(polls.id, pollId)).returning();
  const view = toView(updated!);
  await rebuildCounts(sid, view);
  await redis.set(rk.activePoll(sid), JSON.stringify(view), "EX", 24 * 3600);
  hub.students.to(sessionRoom(sid)).emit("poll:open", { poll: view });
  hub.teachers.to(sessionRoom(sid)).emit("poll:open", { poll: view });
  broadcastResults(sid);
  return { ok: true };
}

export async function closePoll(sid: string, pollId: string): Promise<TeacherAck> {
  const row = await db.query.polls.findFirst({ where: and(eq(polls.id, pollId), eq(polls.sessionId, sid)) });
  if (!row) return { ok: false, reason: "not_found" };
  const [updated] = await db.update(polls).set({ closedAt: new Date() }).where(eq(polls.id, pollId)).returning();
  const view = toView(updated!);
  const current = await getActivePoll(sid);
  if (current?.id === pollId) await redis.del(rk.activePoll(sid));
  const results = await pollResults(sid, view);
  const session = await getSessionById(sid);
  hub.students.to(sessionRoom(sid)).emit("poll:close", { pollId, results: session?.inputs.pollResults ? results : undefined });
  hub.teachers.to(sessionRoom(sid)).emit("poll:close", { pollId, results });
  return { ok: true };
}

export async function myPollChoice(pollId: string, studentId: string): Promise<PollChoice | null> {
  const v = await db.query.pollVotes.findFirst({ where: and(eq(pollVotes.pollId, pollId), eq(pollVotes.studentId, studentId)) });
  return (v?.choice as PollChoice | undefined) ?? null;
}

/** One vote per student, changeable until the poll closes. */
export async function handleVote(ctx: { sessionId?: string; studentId?: string }, raw: unknown): Promise<VoteAck> {
  const parsed = votePayload.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { sessionId, studentId } = ctx;
  if (!sessionId || !studentId) return { ok: false, reason: "not_joined" };
  const session = await getSessionById(sessionId);
  if (!session || session.status !== "live") return { ok: false, reason: "not_live" };
  const poll = await getActivePoll(sessionId);
  if (!poll || poll.id !== parsed.data.pollId) return { ok: false, reason: "closed" };

  const checked = votePayloadFor(poll.kind, poll.options.length).safeParse(parsed.data.choice);
  if (!checked.success) return { ok: false, reason: "invalid" };
  const choice: PollChoice = Array.isArray(checked.data) ? [...checked.data].sort((a, b) => a - b) : checked.data;

  const prev = await myPollChoice(poll.id, studentId);
  await db
    .insert(pollVotes)
    .values({ pollId: poll.id, studentId, choice })
    .onConflictDoUpdate({ target: [pollVotes.pollId, pollVotes.studentId], set: { choice, createdAt: new Date() } });

  const key = rk.poll(sessionId, poll.id);
  const p = redis.multi();
  if (prev === null) p.hincrby(key, "_voters", 1);
  else for (const i of indexes(poll.kind, prev)) p.hincrby(key, String(i), -1);
  for (const i of indexes(poll.kind, choice)) p.hincrby(key, String(i), 1);
  await p.exec();

  broadcastResults(sessionId);
  return { ok: true };
}
