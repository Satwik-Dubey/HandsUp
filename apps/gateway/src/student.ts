import { createHash } from "node:crypto";
import { getDb, sql, students } from "@handsup/db";
import {
  EVENT_KIND,
  LIMITS,
  NAMESPACE,
  REACTIONS,
  isValidJoinCode,
  joinPayload,
  normalizeJoinCode,
  ratePayload,
  reactPayload,
  rk,
  type JoinAck,
  type ReactAck,
  type StudentClientToServer,
  type StudentServerToClient,
} from "@handsup/shared";
import { SignJWT, jwtVerify } from "jose";
import type { Namespace, Server, Socket } from "socket.io";
import { activeCount } from "@handsup/server";
import { env } from "./env";
import { sessionRoom } from "./hub";
import { getActivePoll, handleVote, myPollChoice, pollResults } from "./polls";
import { handleAsk, handleUpvote, loadPublicQuestions, myQuestionState } from "./questions";
import { redis } from "./redis";
import { currentSegment } from "./segments";
import { getSessionByCode, getSessionById } from "./sessions";

interface StudentData {
  sessionId?: string;
  studentId?: string;
  device?: string;
}
type StudentSocket = Socket<StudentClientToServer, StudentServerToClient, Record<string, never>, StudentData>;
export type StudentNamespace = Namespace<StudentClientToServer, StudentServerToClient, Record<string, never>, StudentData>;

const db = getDb(env.databaseUrl);
export const studentRoom = sessionRoom;

function clientIp(socket: Socket): string {
  const fwd = socket.handshake.headers["x-forwarded-for"];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim();
  return first || socket.handshake.address || "unknown";
}

function deviceHash(deviceId: string, salt: string): Buffer {
  return createHash("sha256").update(`${deviceId}:${salt}`).digest();
}

async function signResume(sid: string, studentId: string) {
  return new SignJWT({ sid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(studentId)
    .setAudience("handsup-student")
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(env.realtimeSecret);
}

async function readResume(token: string | undefined, sid: string): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, env.realtimeSecret, { audience: "handsup-student" });
    return payload.sid === sid && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

export function registerStudentNamespace(io: Server): StudentNamespace {
  const nsp = io.of(NAMESPACE.student) as unknown as StudentNamespace;

  nsp.on("connection", (socket: StudentSocket) => {
    socket.on("join", async (raw, ack) => {
      if (typeof ack !== "function") return;
      try {
        ack(await handleJoin(socket, raw));
      } catch (e) {
        console.error("[join]", e);
        ack({ ok: false, error: "server_error" });
      }
    });

    socket.on("react", async (raw, ack) => {
      if (typeof ack !== "function") return;
      try {
        ack(await handleReact(socket, raw));
      } catch (e) {
        console.error("[react]", e);
        ack({ seq: -1, ok: false, reason: "invalid" });
      }
    });

    socket.on("rate", async (raw, ack) => {
      if (typeof ack !== "function") return;
      try {
        ack(await handleRate(socket, raw));
      } catch (e) {
        console.error("[rate]", e);
        ack({ seq: -1, ok: false, reason: "invalid" });
      }
    });

    socket.on("ask", async (raw, ack) => {
      if (typeof ack !== "function") return;
      try {
        ack(await handleAsk(socket.data, raw));
      } catch (e) {
        console.error("[ask]", e);
        ack({ ok: false, reason: "invalid" });
      }
    });

    socket.on("upvote", async (raw, ack) => {
      if (typeof ack !== "function") return;
      try {
        ack(await handleUpvote(socket.data, raw));
      } catch (e) {
        console.error("[upvote]", e);
        ack({ ok: false, reason: "invalid" });
      }
    });

    socket.on("vote", async (raw, ack) => {
      if (typeof ack !== "function") return;
      try {
        ack(await handleVote(socket.data, raw));
      } catch (e) {
        console.error("[vote]", e);
        ack({ ok: false, reason: "invalid" });
      }
    });

    socket.on("hb", async () => {
      const { sessionId, device } = socket.data;
      if (sessionId && device) await redis.zadd(rk.presence(sessionId), Date.now(), device);
    });
  });

  return nsp;
}

async function handleJoin(socket: StudentSocket, raw: unknown): Promise<JoinAck> {
  const parsed = joinPayload.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const code = normalizeJoinCode(parsed.data.code);
  const ipKey = rk.joinAttempts(clientIp(socket));

  // Repeated wrong codes from one address are slowed down to stop code guessing.
  const failures = Number((await redis.get(ipKey)) ?? 0);
  if (failures >= LIMITS.joinAttemptsPerMinute) return { ok: false, error: "too_many_attempts" };

  const session = isValidJoinCode(code) ? await getSessionByCode(code) : null;
  if (!session) {
    await redis.multi().incr(ipKey).expire(ipKey, 60).exec();
    return { ok: false, error: "not_found" };
  }
  if (session.status === "ended") return { ok: false, error: "ended", title: session.title };

  const device = deviceHash(parsed.data.deviceId, session.salt);
  const deviceKey = device.toString("hex").slice(0, 32);

  let studentId = await readResume(parsed.data.resumeToken, session.id);
  if (!studentId) {
    const [row] = await db
      .insert(students)
      .values({ sessionId: session.id, deviceHash: device })
      .onConflictDoUpdate({ target: [students.sessionId, students.deviceHash], set: { lastSeenAt: sql`now()` } })
      .returning({ id: students.id });
    studentId = row!.id;
  }

  // Leave any previous session room (a phone can switch classes without reloading).
  if (socket.data.sessionId && socket.data.sessionId !== session.id) socket.leave(studentRoom(socket.data.sessionId));
  socket.data = { sessionId: session.id, studentId, device: deviceKey };
  socket.join(studentRoom(session.id));

  const now = Date.now();
  const [, , myRating, lastSeq, mine, questions, activePoll, segment] = await Promise.all([
    redis.zadd(rk.presence(session.id), now, deviceKey),
    redis.sadd(rk.joined(session.id), deviceKey),
    redis.hget(rk.rating(session.id), deviceKey),
    redis.get(rk.seq(session.id, deviceKey)),
    myQuestionState(session.id, studentId),
    loadPublicQuestions(session.id),
    getActivePoll(session.id),
    currentSegment(session.id),
  ]);
  const [myChoice, results] = activePoll
    ? await Promise.all([myPollChoice(activePoll.id, studentId), session.inputs.pollResults ? pollResults(session.id, activePoll) : null])
    : [null, null];

  return {
    ok: true,
    studentId,
    resumeToken: await signResume(session.id, studentId),
    session: {
      id: session.id,
      title: session.title,
      status: session.status,
      courseName: session.courseName,
      teacherName: session.teacherName,
      inputs: session.inputs,
    },
    myRating: myRating ? Number(myRating) : null,
    lastSeq: lastSeq ? Number(lastSeq) : -1,
    active: await activeCount(redis, session.id, now),
    ...mine,
    questions,
    activePoll,
    myPollChoice: myChoice,
    pollResults: results,
    segment,
  };
}

async function handleReact(socket: StudentSocket, raw: unknown): Promise<ReactAck> {
  const parsed = reactPayload.safeParse(raw);
  if (!parsed.success) return { seq: -1, ok: false, reason: "invalid" };
  const { seq, counts } = parsed.data;
  const { sessionId, device, studentId } = socket.data;
  if (!sessionId || !device) return { seq, ok: false, reason: "not_joined" };

  const session = await getSessionById(sessionId);
  if (!session || session.status !== "live") return { seq, ok: false, reason: "not_live" };

  // Respect the teacher's input toggles.
  const allowed = REACTIONS.filter((r) => (r === "confused" ? session.inputs.confused : session.inputs.react));
  const taps = allowed.map((r) => [r, counts[r] ?? 0] as const).filter(([, n]) => n > 0);
  const cost = taps.reduce((a, [, n]) => a + n, 0);
  if (cost === 0) return { seq, ok: true };

  if (!(await redis.acceptSeq(rk.seq(sessionId, device), seq))) return { seq, ok: true, reason: "duplicate" };
  const now = Date.now();
  if (!(await redis.takeTokens(rk.rateLimit(sessionId, device), LIMITS.bucketCapacity, LIMITS.bucketRefillPerSec, now, cost))) {
    return { seq, ok: false, reason: "rate_limited" };
  }

  const secKey = rk.second(sessionId, Math.floor(now / 1000));
  const p = redis.pipeline();
  for (const [r, n] of taps) {
    p.hincrby(rk.count(sessionId), r, n);
    p.hincrby(secKey, r, n);
    p.zadd(rk.reactors(sessionId, r), now, device);
    // Raw events go on the stream; the aggregator worker folds them into 5-second windows.
    p.xadd(rk.eventsStream, "MAXLEN", "~", "100000", "*", "sid", sessionId, "stu", studentId ?? "", "k", String(EVENT_KIND[r]), "v", String(n), "t", String(now));
  }
  p.expire(secKey, 130);
  p.zadd(rk.reactors(sessionId, "any"), now, device);
  p.zadd(rk.presence(sessionId), now, device);
  await p.exec();
  return { seq, ok: true };
}

async function handleRate(socket: StudentSocket, raw: unknown): Promise<ReactAck> {
  const parsed = ratePayload.safeParse(raw);
  if (!parsed.success) return { seq: -1, ok: false, reason: "invalid" };
  const { seq, value } = parsed.data;
  const { sessionId, device, studentId } = socket.data;
  if (!sessionId || !device) return { seq, ok: false, reason: "not_joined" };

  const session = await getSessionById(sessionId);
  if (!session || session.status !== "live") return { seq, ok: false, reason: "not_live" };
  if (!session.inputs.rating) return { seq, ok: false, reason: "invalid" };
  if (!(await redis.acceptSeq(rk.seq(sessionId, device), seq))) return { seq, ok: true, reason: "duplicate" };

  const now = Date.now();
  await redis
    .pipeline()
    .hset(rk.rating(sessionId), device, value)
    .zadd(rk.presence(sessionId), now, device)
    .xadd(rk.eventsStream, "MAXLEN", "~", "100000", "*", "sid", sessionId, "stu", studentId ?? "", "k", String(EVENT_KIND.rating), "v", String(value), "t", String(now))
    .exec();
  return { seq, ok: true };
}
