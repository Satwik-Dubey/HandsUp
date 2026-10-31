/**
 * Aggregator: folds the raw `events` stream into 5-second windows.
 *
 * For every live session it writes one `metrics_5s` row per window (the timeline and,
 * later, the report read these) and publishes it so the gateway can push it to the
 * teacher's dashboard. It also copies raw taps into the `events` table (kept 7 days).
 */
import { eq, events as eventsTable, getDb, metrics5s, sessions } from "@handsup/db";
import { computeSnapshot, createRedis } from "@handsup/server";
import {
  EVENT_KIND,
  LIMITS,
  emptyCounts,
  rk,
  type ReactionCounts,
  type SegmentView,
  type TeacherChannelMessage,
  type WindowEvent,
} from "@handsup/shared";
import { env } from "./env";

const GROUP = "aggregator";
const W = LIMITS.windowMs;
/** A window is closed this long after it ends, so late taps still land in it. */
const GRACE_MS = 1500;

const db = getDb(env.databaseUrl);
const redis = createRedis(env.redisUrl, "agg");
const reader = createRedis(env.redisUrl, "agg:reader"); // XREADGROUP BLOCK holds its connection

const KIND_NAME = Object.fromEntries(Object.entries(EVENT_KIND).map(([name, code]) => [code, name])) as Record<number, string>;

interface OpenWindow {
  reactions: ReactionCounts;
  questionCount: number;
}
const open = new Map<string, OpenWindow>(); // `${sid}:${bucket}`
const live = new Map<string, number>(); // sid → started at (ms)
const lastClosed = new Map<string, number>(); // sid → last closed bucket start

function windowFor(sid: string, bucket: number): OpenWindow {
  const key = `${sid}:${bucket}`;
  let w = open.get(key);
  if (!w) open.set(key, (w = { reactions: emptyCounts(), questionCount: 0 }));
  return w;
}

async function ensureGroups() {
  for (const stream of [rk.eventsStream, rk.questionsStream]) {
    try {
      await redis.xgroup("CREATE", stream, GROUP, "$", "MKSTREAM");
    } catch (e) {
      if (!String((e as Error).message).includes("BUSYGROUP")) throw e;
    }
  }
}

async function refreshLiveSessions() {
  const rows = await db.select({ id: sessions.id, startedAt: sessions.startedAt }).from(sessions).where(eq(sessions.status, "live"));
  const ids = new Set(rows.map((r) => r.id));
  for (const r of rows) live.set(r.id, r.startedAt?.getTime() ?? Date.now());
  for (const sid of [...live.keys()]) {
    if (!ids.has(sid)) {
      live.delete(sid);
      lastClosed.delete(sid);
    }
  }
}

type Row = typeof eventsTable.$inferInsert;

async function persistRaw(rows: Row[]) {
  if (!rows.length) return;
  try {
    await db.insert(eventsTable).values(rows);
  } catch {
    // One bad row (e.g. a session deleted meanwhile) shouldn't drop the rest.
    for (const r of rows) await db.insert(eventsTable).values(r).catch(() => {});
  }
}

async function consumeLoop() {
  for (;;) {
    try {
      const res = (await reader.xreadgroup(
        "GROUP", GROUP, env.consumerName,
        "COUNT", 1000, "BLOCK", 1000,
        "STREAMS", rk.eventsStream, rk.questionsStream, ">", ">",
      )) as [string, [string, string[]][]][] | null;
      if (!res) continue;

      const raw: Row[] = [];
      for (const [stream, entries] of res) {
        for (const [, fields] of entries) {
          const f: Record<string, string> = {};
          for (let i = 0; i < fields.length; i += 2) f[fields[i]!] = fields[i + 1]!;
          const t = Number(f.t);
          if (!f.sid || !Number.isFinite(t)) continue;
          const w = windowFor(f.sid, Math.floor(t / W) * W);
          if (stream === rk.questionsStream) {
            w.questionCount++;
            continue;
          }
          const kind = Number(f.k);
          const value = Number(f.v);
          const name = KIND_NAME[kind];
          if (name && name !== "rating") w.reactions[name as keyof ReactionCounts] += value;
          raw.push({ time: new Date(t), sessionId: f.sid, studentId: f.stu || null, kind, value });
        }
        await redis.xack(stream, GROUP, ...entries.map(([id]) => id));
      }
      await persistRaw(raw);
    } catch (e) {
      console.error("[aggregator] read failed:", (e as Error).message);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

async function closeWindow(sid: string, bucket: number) {
  const key = `${sid}:${bucket}`;
  const w = open.get(key) ?? { reactions: emptyCounts(), questionCount: 0 };
  open.delete(key);

  // Rolling "last minute" numbers come from the same Redis counters as the live tick.
  const [snap, segRaw] = await Promise.all([computeSnapshot(redis, sid, "live"), redis.get(rk.segment(sid))]);
  const segment = segRaw ? (JSON.parse(segRaw) as SegmentView) : null;
  const data: WindowEvent = {
    sessionId: sid,
    bucket,
    active: snap.active,
    joined: snap.joined,
    reactions: w.reactions,
    understanding: snap.understanding,
    confusedRatio: snap.confusedRatio,
    engaged: snap.engaged,
    avgRating: snap.avgRating,
    questionCount: w.questionCount,
    segmentId: segment?.id ?? null,
  };
  const row = {
    bucket: new Date(bucket),
    sessionId: sid,
    active: data.active,
    joined: data.joined,
    reactions: data.reactions,
    confusedRatio: data.confusedRatio,
    engaged: data.engaged,
    avgRating: data.avgRating,
    understanding: data.understanding,
    questionCount: data.questionCount,
    segmentId: data.segmentId,
  };
  await db.insert(metrics5s).values(row).onConflictDoUpdate({ target: [metrics5s.sessionId, metrics5s.bucket], set: row });
  const msg: TeacherChannelMessage = { type: "window", data };
  await redis.publish(rk.teacherChannel(sid), JSON.stringify(msg));
}

async function closeDueWindows() {
  const now = Date.now();
  for (const [sid, startedAt] of live) {
    const firstBucket = Math.floor(startedAt / W) * W;
    // After a restart, only catch up the last minute instead of every missed window.
    let b = Math.max((lastClosed.get(sid) ?? -Infinity) + W, firstBucket, Math.floor((now - 60_000) / W) * W);
    for (; b + W + GRACE_MS <= now; b += W) {
      try {
        await closeWindow(sid, b);
        lastClosed.set(sid, b);
      } catch (e) {
        console.error("[aggregator] window failed", sid, (e as Error).message);
        break;
      }
    }
  }
  // Windows of sessions that aren't live (e.g. taps that raced the end) are dropped after a minute.
  for (const key of open.keys()) {
    const bucket = Number(key.split(":")[1]);
    if (bucket < now - 60_000) open.delete(key);
  }
}

export async function startAggregator() {
  await ensureGroups();
  await refreshLiveSessions();
  setInterval(() => refreshLiveSessions().catch((e) => console.error("[aggregator] sessions:", e.message)), 3000);
  setInterval(() => closeDueWindows().catch((e) => console.error("[aggregator] close:", e.message)), 1000);
  void consumeLoop();
  console.log(`[aggregator] running as ${env.consumerName}, ${W / 1000}s windows`);
}

export async function stopAggregator() {
  await Promise.allSettled([redis.quit(), reader.quit()]);
}
