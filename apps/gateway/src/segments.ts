import { count, eq, getDb, segments } from "@handsup/db";
import { rk, segmentPayload, type SegmentView, type TeacherAck } from "@handsup/shared";
import { env } from "./env";
import { hub, sessionRoom } from "./hub";
import { redis } from "./redis";

const db = getDb(env.databaseUrl);

export async function currentSegment(sid: string): Promise<SegmentView | null> {
  const raw = await redis.get(rk.segment(sid));
  return raw ? (JSON.parse(raw) as SegmentView) : null;
}

/** The dashboard's "Next slide" button: starts a new segment that questions and timeline points are tagged with. */
export async function markSegment(sid: string, raw: unknown): Promise<TeacherAck> {
  const parsed = segmentPayload.safeParse(raw ?? {});
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const [{ n }] = await db.select({ n: count() }).from(segments).where(eq(segments.sessionId, sid));
  const label = parsed.data.label || `Slide ${n + 1}`;
  const [row] = await db.insert(segments).values({ sessionId: sid, label, source: "manual" }).returning();
  const view: SegmentView = { id: row!.id, label: row!.label, startsAt: row!.startsAt.getTime() };
  await redis.set(rk.segment(sid), JSON.stringify(view), "EX", 24 * 3600);
  hub.students.to(sessionRoom(sid)).emit("segment", view);
  hub.teachers.to(sessionRoom(sid)).emit("segment", view);
  return { ok: true };
}
