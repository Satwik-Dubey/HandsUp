import { and, count, desc, eq, getDb, inArray, questionVotes, questions, segments, sql } from "@handsup/db";
import { cleanQuestion, isProfane, keyedThrottle } from "@handsup/server";
import {
  LIMITS,
  askPayload,
  rk,
  upvotePayload,
  type AskAck,
  type PublicQuestion,
  type QuestionStatus,
  type TeacherQuestion,
  type TeacherQuestionsEvent,
  type UpvoteAck,
} from "@handsup/shared";
import { env } from "./env";
import { hub, sessionRoom } from "./hub";
import { redis } from "./redis";
import { getSessionById } from "./sessions";
import { currentSegment } from "./segments";

const db = getDb(env.databaseUrl);

export async function loadPublicQuestions(sid: string): Promise<PublicQuestion[]> {
  const rows = await db
    .select({ id: questions.id, text: questions.body, votes: questions.upvotes, status: questions.status, createdAt: questions.createdAt })
    .from(questions)
    .where(and(eq(questions.sessionId, sid), inArray(questions.status, ["open", "answered"])))
    .orderBy(sql`${questions.status} = 'answered'`, desc(questions.upvotes), desc(questions.createdAt))
    .limit(LIMITS.topQuestions);
  return rows.map((r) => ({ ...r, status: r.status as "open" | "answered", createdAt: r.createdAt.getTime() }));
}

async function loadTeacherQuestions(sid: string): Promise<TeacherQuestionsEvent> {
  const [rows, counts] = await Promise.all([
    db
      .select({
        id: questions.id,
        text: questions.body,
        votes: questions.upvotes,
        status: questions.status,
        createdAt: questions.createdAt,
        segmentLabel: segments.label,
        clusterId: questions.clusterId,
      })
      .from(questions)
      .leftJoin(segments, eq(segments.id, questions.segmentId))
      .where(and(eq(questions.sessionId, sid), sql`${questions.status} <> 'hidden'`))
      .orderBy(desc(questions.upvotes), desc(questions.createdAt))
      .limit(200),
    db.select({ status: questions.status, n: count() }).from(questions).where(eq(questions.sessionId, sid)).groupBy(questions.status),
  ]);
  const by = Object.fromEntries(counts.map((c) => [c.status, c.n])) as Record<string, number>;
  return {
    total: counts.reduce((a, c) => a + c.n, 0),
    pending: by.pending ?? 0,
    answered: by.answered ?? 0,
    questions: rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() })),
  };
}

/** Sends the latest lists to phones (top questions) and the teacher (all), at most once a second per session. */
export const broadcastQuestions = keyedThrottle(1000, async (sid) => {
  const [pub, teacher] = await Promise.all([loadPublicQuestions(sid), loadTeacherQuestions(sid)]);
  hub.students.to(sessionRoom(sid)).emit("questions:top", pub);
  hub.teachers.to(sessionRoom(sid)).emit("questions", teacher);
});

export async function sendTeacherQuestions(sid: string, emit: (e: TeacherQuestionsEvent) => void) {
  emit(await loadTeacherQuestions(sid));
}

export async function myQuestionState(sid: string, studentId: string) {
  const [mine, votes] = await Promise.all([
    db.select({ id: questions.id }).from(questions).where(and(eq(questions.sessionId, sid), eq(questions.studentId, studentId))),
    db
      .select({ id: questionVotes.questionId })
      .from(questionVotes)
      .innerJoin(questions, eq(questions.id, questionVotes.questionId))
      .where(and(eq(questions.sessionId, sid), eq(questionVotes.studentId, studentId))),
  ]);
  return { myQuestionIds: mine.map((r) => r.id), myUpvoteIds: votes.map((r) => r.id) };
}

export async function handleAsk(ctx: { sessionId?: string; studentId?: string; device?: string }, raw: unknown): Promise<AskAck> {
  const parsed = askPayload.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { sessionId, studentId, device } = ctx;
  if (!sessionId || !studentId || !device) return { ok: false, reason: "not_joined" };
  const session = await getSessionById(sessionId);
  if (!session || session.status !== "live") return { ok: false, reason: "not_live" };
  if (!session.inputs.questions) return { ok: false, reason: "disabled" };

  const text = cleanQuestion(parsed.data.text);
  if (text.length < 2) return { ok: false, reason: "invalid" };

  // A retry after a reconnect returns the question that was already saved.
  const existing = await db.query.questions.findFirst({
    where: and(eq(questions.sessionId, sessionId), eq(questions.clientId, parsed.data.clientId)),
    columns: { id: true, status: true },
  });
  if (existing) return { ok: true, id: existing.id, status: existing.status };

  if (isProfane(text)) return { ok: false, reason: "profanity" };
  const now = Date.now();
  if (!(await redis.takeTokens(rk.questionRateLimit(sessionId, device), LIMITS.questionBucketCapacity, LIMITS.questionRefillPerSec, now, 1))) {
    return { ok: false, reason: "rate_limited" };
  }

  const [segment, muted] = await Promise.all([currentSegment(sessionId), redis.sismember(rk.muted(sessionId), studentId)]);
  // A muted student's questions are saved but hidden; their phone shows "waiting for review".
  const status: QuestionStatus = muted ? "hidden" : session.reviewQuestionsFirst ? "pending" : "open";
  const [row] = await db
    .insert(questions)
    .values({ sessionId, studentId, clientId: parsed.data.clientId, body: text, status, segmentId: segment?.id ?? null })
    .onConflictDoNothing({ target: [questions.sessionId, questions.clientId] })
    .returning({ id: questions.id, createdAt: questions.createdAt });
  if (!row) return { ok: false, reason: "invalid" };

  // The NLP worker reads this stream to group questions; the aggregator counts it per window.
  await redis.xadd(rk.questionsStream, "MAXLEN", "~", "100000", "*", "sid", sessionId, "qid", row.id, "t", String(now));

  if (status === "hidden") return { ok: true, id: row.id, status: "pending" };
  const q: TeacherQuestion = { id: row.id, text, votes: 0, status, createdAt: row.createdAt.getTime(), segmentLabel: segment?.label ?? null, clusterId: null };
  hub.teachers.to(sessionRoom(sessionId)).emit("question:new", q);
  broadcastQuestions(sessionId);
  return { ok: true, id: row.id, status };
}

export async function handleUpvote(ctx: { sessionId?: string; studentId?: string }, raw: unknown): Promise<UpvoteAck> {
  const parsed = upvotePayload.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { sessionId, studentId } = ctx;
  if (!sessionId || !studentId) return { ok: false, reason: "not_joined" };
  const session = await getSessionById(sessionId);
  if (!session || session.status !== "live") return { ok: false, reason: "not_live" };
  const qid = parsed.data.questionId;

  const result = await db.transaction(async (tx) => {
    const q = await tx.query.questions.findFirst({
      where: and(eq(questions.id, qid), eq(questions.sessionId, sessionId), inArray(questions.status, ["open", "answered"])),
      columns: { id: true },
    });
    if (!q) return null;
    const inserted = await tx.insert(questionVotes).values({ questionId: qid, studentId }).onConflictDoNothing().returning();
    let voted = true;
    if (!inserted.length) {
      // Second tap undoes the vote.
      await tx.delete(questionVotes).where(and(eq(questionVotes.questionId, qid), eq(questionVotes.studentId, studentId)));
      voted = false;
    }
    const [u] = await tx
      .update(questions)
      .set({ upvotes: sql`greatest(0, ${questions.upvotes} + ${voted ? 1 : -1})` })
      .where(eq(questions.id, qid))
      .returning({ votes: questions.upvotes });
    return { voted, votes: u!.votes };
  });
  if (!result) return { ok: false, reason: "not_found" };
  broadcastQuestions(sessionId);
  return { ok: true, ...result };
}

/** Mutes the student who asked a question: hides everything they asked and hides their future questions. */
export async function muteAuthor(sid: string, questionId: string) {
  const q = await db.query.questions.findFirst({ where: and(eq(questions.id, questionId), eq(questions.sessionId, sid)), columns: { studentId: true } });
  if (!q?.studentId) return false;
  await redis.sadd(rk.muted(sid), q.studentId);
  await redis.expire(rk.muted(sid), 7 * 24 * 3600);
  await db.update(questions).set({ status: "hidden" }).where(and(eq(questions.sessionId, sid), eq(questions.studentId, q.studentId)));
  broadcastQuestions(sid);
  return true;
}

const NEXT_STATUS = { answer: "answered", hide: "hidden", approve: "open", reopen: "open" } as const;

export async function setQuestionStatus(sid: string, id: string, action: keyof typeof NEXT_STATUS) {
  const rows = await db
    .update(questions)
    .set({ status: NEXT_STATUS[action] })
    .where(and(eq(questions.id, id), eq(questions.sessionId, sid)))
    .returning({ id: questions.id });
  if (rows.length) broadcastQuestions(sid);
  return rows.length > 0;
}
