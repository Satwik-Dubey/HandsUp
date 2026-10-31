import { and, desc, eq, getDb, gte, insights, loadClusters } from "@handsup/db";
import { computeSnapshot } from "@handsup/server";
import {
  NAMESPACE,
  idPayload,
  pollIdPayload,
  toInsightView,
  type TeacherAck,
  type TeacherClientToServer,
  type TeacherServerToClient,
} from "@handsup/shared";
import { jwtVerify } from "jose";
import type { Namespace, Server, Socket } from "socket.io";
import { env } from "./env";
import { sessionRoom } from "./hub";
import { closePoll, getActivePoll, launchPoll, pollResults } from "./polls";
import { muteAuthor, sendTeacherQuestions, setQuestionStatus } from "./questions";
import { redis } from "./redis";
import { currentSegment, markSegment } from "./segments";
import { getSessionById } from "./sessions";

const db = getDb(env.databaseUrl);

/** The last hour of insights, newest first, for a dashboard that just connected. */
async function recentInsights(sid: string) {
  const rows = await db
    .select()
    .from(insights)
    .where(and(eq(insights.sessionId, sid), gte(insights.at, new Date(Date.now() - 3600_000))))
    .orderBy(desc(insights.at))
    .limit(30);
  return rows.map(toInsightView);
}

async function ackInsight(sid: string, id: string) {
  const rows = await db
    .update(insights)
    .set({ acknowledgedAt: new Date() })
    .where(and(eq(insights.id, id), eq(insights.sessionId, sid)))
    .returning({ id: insights.id });
  return rows.length > 0;
}

interface TeacherData {
  sessionId: string;
  teacherId: string;
}
export type TeacherNamespace = Namespace<TeacherClientToServer, TeacherServerToClient, Record<string, never>, TeacherData>;
export const teacherRoom = sessionRoom;

/**
 * Teachers connect with a short-lived token from the web app
 * (GET /api/sessions/:id/realtime-token), which already checked that they own the session.
 */
export function registerTeacherNamespace(io: Server): TeacherNamespace {
  const nsp = io.of(NAMESPACE.teacher) as unknown as TeacherNamespace;

  nsp.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string") return next(new Error("unauthorized"));
    try {
      const { payload } = await jwtVerify(token, env.realtimeSecret, { audience: "handsup-teacher" });
      if (typeof payload.sid !== "string" || !payload.sub) return next(new Error("unauthorized"));
      socket.data = { sessionId: payload.sid, teacherId: payload.sub };
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  nsp.on("connection", async (socket: Socket<TeacherClientToServer, TeacherServerToClient, Record<string, never>, TeacherData>) => {
    const { sessionId } = socket.data;
    socket.join(teacherRoom(sessionId));
    const sendNow = async () => {
      const s = await getSessionById(sessionId);
      if (s) socket.emit("tick", await computeSnapshot(redis, sessionId, s.status));
    };
    socket.on("tick:now", () => void sendNow());

    // Wraps a teacher command: validates, runs, always acks.
    const command = <T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }, run: (p: T) => Promise<TeacherAck | boolean>) =>
      async (raw: unknown, ack: (a: TeacherAck) => void) => {
        if (typeof ack !== "function") return;
        const parsed = schema.safeParse(raw);
        if (!parsed.success) return ack({ ok: false, reason: "invalid" });
        try {
          const r = await run(parsed.data as T);
          ack(typeof r === "boolean" ? (r ? { ok: true } : { ok: false, reason: "not_found" }) : r);
        } catch (e) {
          console.error("[teacher]", e);
          ack({ ok: false, reason: "server_error" });
        }
      };
    const anything = { safeParse: (v: unknown) => ({ success: true, data: v }) };

    socket.on("question:answer", command(idPayload, (p) => setQuestionStatus(sessionId, p.id, "answer")));
    socket.on("question:hide", command(idPayload, (p) => setQuestionStatus(sessionId, p.id, "hide")));
    socket.on("question:approve", command(idPayload, (p) => setQuestionStatus(sessionId, p.id, "approve")));
    socket.on("question:reopen", command(idPayload, (p) => setQuestionStatus(sessionId, p.id, "reopen")));
    socket.on("poll:launch", command(pollIdPayload, (p) => launchPoll(sessionId, p.pollId)));
    socket.on("poll:close", command(pollIdPayload, (p) => closePoll(sessionId, p.pollId)));
    socket.on("segment:mark", command(anything, (p) => markSegment(sessionId, p)));
    socket.on(
      "insight:ack",
      command(idPayload, async (p) => {
        const ok = await ackInsight(sessionId, p.id);
        if (ok) socket.nsp.to(teacherRoom(sessionId)).emit("insight:ack", { id: p.id });
        return ok;
      }),
    );
    socket.on("student:mute", command(idPayload, (p) => muteAuthor(sessionId, p.id)));

    // Initial state, so a reloaded dashboard needs nothing else.
    await sendNow();
    await sendTeacherQuestions(sessionId, (e) => socket.emit("questions", e));
    const [poll, segment, groups, recent] = await Promise.all([
      getActivePoll(sessionId),
      currentSegment(sessionId),
      loadClusters(db, sessionId),
      recentInsights(sessionId),
    ]);
    socket.emit("segment", segment);
    socket.emit("clusters", groups);
    socket.emit("insights", recent);
    if (poll) {
      socket.emit("poll:open", { poll });
      socket.emit("poll:results", await pollResults(sessionId, poll));
    }
  });

  return nsp;
}
