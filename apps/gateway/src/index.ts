import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { createAdapter } from "@socket.io/redis-adapter";
import { closeDb } from "@handsup/db";
import { activeCount, computeSnapshot, trimSession } from "@handsup/server";
import { LIMITS, rk, type ControlMessage, type TeacherChannelMessage } from "@handsup/shared";
import { Server } from "socket.io";
import { env } from "./env";
import { hub } from "./hub";
import { pub, redis, sub } from "./redis";
import { invalidateSession, getSessionById } from "./sessions";
import { registerStudentNamespace, studentRoom } from "./student";
import { registerTeacherNamespace, teacherRoom } from "./teacher";
import { sendTeacherQuestions } from "./questions";

if (process.env.SENTRY_DSN) {
  const Sentry = await import("@sentry/node");
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV ?? "development", tracesSampleRate: 0 });
  console.log("[gateway] Sentry on");
}

const startedAt = Date.now();
const http = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: redis.status === "ready", redis: redis.status }));
    return;
  }
  if (req.url === "/metrics") {
    // Small JSON for the load test and for watching a deployment.
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        students: students.sockets.size,
        teachers: teachers.sockets.size,
        liveRooms: roomsWithSockets(students).length,
        uptimeSec: Math.round((Date.now() - startedAt) / 1000),
        memoryMb: Math.round(process.memoryUsage().rss / 1e6),
      }),
    );
    return;
  }
  if (req.url?.startsWith("/internal/") && req.method === "POST") {
    handleInternal(req, res).catch((e) => {
      console.error("[internal]", e);
      if (!res.headersSent) res.writeHead(500).end();
    });
    return;
  }
  res.writeHead(404).end();
});

/**
 * Server-to-server calls from the website, for hosts where the website can't reach Redis
 * itself (e.g. Vercel + Render's free Redis). Protected by REALTIME_SECRET.
 *   POST /internal/control        body: ControlMessage          → published on the control channel
 *   POST /internal/join-attempts  body: { ip, miss?: boolean }   → { count } wrong-code attempts this minute
 */
async function handleInternal(req: IncomingMessage, res: ServerResponse) {
  const given = Buffer.from((req.headers.authorization ?? "").replace(/^Bearer /, ""));
  const want = Buffer.from(env.realtimeSecretText);
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    res.writeHead(401).end();
    return;
  }
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) {
      res.writeHead(413).end();
      return;
    }
  }
  const body = JSON.parse(raw || "{}");
  const json = (data: unknown) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(data));
  };

  if (req.url === "/internal/control") {
    const types = ["session:status", "session:updated", "demo:start"];
    if (!types.includes(body?.type) || typeof body?.sessionId !== "string") {
      res.writeHead(400).end();
      return;
    }
    await pub.publish(rk.controlChannel, JSON.stringify(body as ControlMessage));
    return json({ ok: true });
  }
  if (req.url === "/internal/join-attempts") {
    const key = rk.joinAttempts(String(body?.ip ?? "unknown"));
    if (body?.miss) {
      const [[, count]] = (await redis.multi().incr(key).expire(key, 60).exec()) as [[unknown, number]];
      return json({ count });
    }
    return json({ count: Number((await redis.get(key)) ?? 0) });
  }
  res.writeHead(404).end();
}

const io = new Server(http, {
  cors: { origin: env.corsOrigins.length ? env.corsOrigins : true, credentials: true },
  // Phones on flaky Wi-Fi: keep sessions alive through short drops.
  pingInterval: 20_000,
  pingTimeout: 25_000,
  connectionStateRecovery: { maxDisconnectionDuration: 2 * 60_000 },
});
io.adapter(createAdapter(pub, sub));

const students = registerStudentNamespace(io);
const teachers = registerTeacherNamespace(io);
hub.students = students;
hub.teachers = teachers;

/** Sessions with someone connected on this gateway instance. */
function roomsWithSockets(nsp: { adapter: { rooms: Map<string, Set<string>> } }): string[] {
  const ids: string[] = [];
  for (const [room, members] of nsp.adapter.rooms) if (room.startsWith("sess:") && members.size) ids.push(room.slice(5));
  return ids;
}

// ---- 1 s ticker: live counters to teachers, presence to phones every 5 s ----
let tickNo = 0;
setInterval(async () => {
  tickNo++;
  const teacherSessions = roomsWithSockets(teachers);
  await Promise.all(
    teacherSessions.map(async (sid) => {
      try {
        const s = await getSessionById(sid);
        if (!s) return;
        teachers.local.to(teacherRoom(sid)).emit("tick", await computeSnapshot(redis, sid, s.status));
      } catch (e) {
        console.error("[tick]", sid, (e as Error).message);
      }
    }),
  );
  if (tickNo % 5 === 0) {
    for (const sid of roomsWithSockets(students)) {
      activeCount(redis, sid)
        .then((active) => students.local.to(studentRoom(sid)).emit("presence", { active }))
        .catch(() => {});
    }
  }
  if (tickNo % 30 === 0) {
    for (const sid of new Set([...teacherSessions, ...roomsWithSockets(students)])) trimSession(redis, sid).catch(() => {});
  }
}, 1000);

// ---- control messages from the web app (go live, end class, settings changed) ----
const control = sub.duplicate();
control.subscribe(rk.controlChannel).catch((e) => console.error("[control] subscribe failed", e));
control.on("message", async (_ch, raw) => {
  let msg: ControlMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  invalidateSession(msg.sessionId);
  if (msg.type === "session:status") {
    // Emit through the adapter so every gateway instance relays it.
    students.to(studentRoom(msg.sessionId)).emit("session:status", { status: msg.status });
    teachers.to(teacherRoom(msg.sessionId)).emit("session:status", { status: msg.status });
    if (msg.status === "ended") students.to(studentRoom(msg.sessionId)).emit("session:ended", {});
  }
});

// ---- worker output (5-second windows) → the teacher's dashboard ----
// Every gateway instance gets every message, so each relays only to its own sockets.
control.psubscribe(rk.teacherChannelPattern).catch((e) => console.error("[workers] psubscribe failed", e));
control.on("pmessage", (_pattern, channel, raw) => {
  const sid = channel.split(":")[2];
  if (!sid) return;
  try {
    const msg = JSON.parse(raw) as TeacherChannelMessage;
    const room = teachers.local.to(teacherRoom(sid));
    if (msg.type === "window") room.emit("window", msg.data);
    else if (msg.type === "insight") room.emit("insight:new", msg.data);
    else if (msg.type === "clusters") room.emit("clusters", msg.data);
    else if (msg.type === "questions:changed") sendTeacherQuestions(sid, (e) => room.emit("questions", e)).catch(() => {});
  } catch {}
});

http.listen(env.port, () => {
  console.log(`[gateway] listening on :${env.port} (students ${"/s"}, teachers ${"/t"}), heartbeat ${LIMITS.heartbeatMs / 1000}s`);
});

async function shutdown() {
  console.log("[gateway] shutting down");
  io.close();
  await Promise.allSettled([redis.quit(), pub.quit(), sub.quit(), control.quit(), closeDb()]);
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
