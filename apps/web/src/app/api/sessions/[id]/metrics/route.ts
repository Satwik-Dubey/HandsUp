import { and, asc, eq, gte, lte, metrics5s, segments, sql } from "@handsup/db";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireOwnedSession } from "@/lib/teacher";

/**
 * Timeline history: GET /api/sessions/:id/metrics?from=&to=&step=5s|1m
 * The dashboard loads this on open, then appends live `window` events, so a reload has no gaps.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session } = await requireOwnedSession((await ctx.params).id);
  const q = req.nextUrl.searchParams;
  const from = q.get("from") ? new Date(Number(q.get("from"))) : new Date(0);
  const to = q.get("to") ? new Date(Number(q.get("to"))) : new Date(Date.now() + 60_000);
  const step = q.get("step") === "1m" ? "1m" : "5s";
  const where = and(eq(metrics5s.sessionId, session.id), gte(metrics5s.bucket, from), lte(metrics5s.bucket, to));

  const windows =
    step === "5s"
      ? await db
          .select({
            bucket: sql<number>`(extract(epoch from ${metrics5s.bucket}) * 1000)::bigint`.mapWith(Number),
            active: metrics5s.active,
            joined: metrics5s.joined,
            reactions: metrics5s.reactions,
            understanding: metrics5s.understanding,
            confusedRatio: metrics5s.confusedRatio,
            engaged: metrics5s.engaged,
            avgRating: metrics5s.avgRating,
            questionCount: metrics5s.questionCount,
            segmentId: metrics5s.segmentId,
          })
          .from(metrics5s)
          .where(where)
          .orderBy(asc(metrics5s.bucket))
      : await db
          .select({
            bucket: sql<number>`(extract(epoch from date_trunc('minute', ${metrics5s.bucket})) * 1000)::bigint`.mapWith(Number),
            active: sql<number>`max(${metrics5s.active})`.mapWith(Number),
            joined: sql<number>`max(${metrics5s.joined})`.mapWith(Number),
            reactions: sql<Record<string, number>>`'{}'::jsonb`,
            understanding: sql<number | null>`avg(${metrics5s.understanding})`.mapWith((v) => (v === null ? null : Number(v))),
            confusedRatio: sql<number>`avg(${metrics5s.confusedRatio})`.mapWith(Number),
            engaged: sql<number>`avg(${metrics5s.engaged})`.mapWith(Number),
            avgRating: sql<number | null>`avg(${metrics5s.avgRating})`.mapWith((v) => (v === null ? null : Number(v))),
            questionCount: sql<number>`sum(${metrics5s.questionCount})`.mapWith(Number),
            segmentId: sql<string | null>`(array_agg(${metrics5s.segmentId}::text order by ${metrics5s.bucket} desc))[1]`,
          })
          .from(metrics5s)
          .where(where)
          .groupBy(sql`date_trunc('minute', ${metrics5s.bucket})`)
          .orderBy(sql`date_trunc('minute', ${metrics5s.bucket})`);

  const segs = await db
    .select({ id: segments.id, label: segments.label, startsAt: segments.startsAt })
    .from(segments)
    .where(eq(segments.sessionId, session.id))
    .orderBy(asc(segments.startsAt));

  return NextResponse.json(
    {
      startedAt: session.startedAt?.getTime() ?? null,
      endedAt: session.endedAt?.getTime() ?? null,
      step,
      windows,
      segments: segs.map((s) => ({ ...s, startsAt: s.startsAt.getTime() })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
