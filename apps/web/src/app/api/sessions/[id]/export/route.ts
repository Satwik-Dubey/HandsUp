import { asc, desc, eq, inArray, metrics5s, pollVotes, polls, questions, segments, sql } from "@handsup/db";
import { RATING_OPTIONS, REACTIONS, type PollChoice } from "@handsup/shared";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { csvResponse, fileSlug } from "@/lib/csv";
import { requireOwnedSession } from "@/lib/teacher";

/**
 * CSV exports: GET /api/sessions/:id/export?type=timeline|questions|polls
 * timeline: one row per 5-second window · questions: every visible question · polls: votes per option.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session } = await requireOwnedSession((await ctx.params).id);
  const type = req.nextUrl.searchParams.get("type") ?? "timeline";
  const t0 = (session.startedAt ?? session.createdAt).getTime();
  let rows: (string | number | null)[][];

  if (type === "questions") {
    const qs = await db
      .select({
        body: questions.body,
        upvotes: questions.upvotes,
        status: questions.status,
        createdAt: questions.createdAt,
        sentiment: questions.sentiment,
        slide: segments.label,
        group: sql<string | null>`(select label from clusters where clusters.id = ${questions.clusterId})`,
      })
      .from(questions)
      .leftJoin(segments, eq(segments.id, questions.segmentId))
      .where(eq(questions.sessionId, session.id))
      .orderBy(desc(questions.upvotes), asc(questions.createdAt));
    rows = [
      ["asked_at", "minute", "question", "upvotes", "status", "slide", "group", "sentiment"],
      ...qs
        .filter((q) => q.status !== "hidden")
        .map((q) => [q.createdAt.toISOString(), Math.floor((q.createdAt.getTime() - t0) / 60_000), q.body, q.upvotes, q.status, q.slide, q.group, q.sentiment]),
    ];
  } else if (type === "polls") {
    const ps = await db.select().from(polls).where(eq(polls.sessionId, session.id)).orderBy(asc(polls.position));
    const votes = ps.length
      ? await db
          .select()
          .from(pollVotes)
          .where(
            inArray(
              pollVotes.pollId,
              ps.map((p) => p.id),
            ),
          )
      : [];
    rows = [["poll", "kind", "option", "votes", "share"]];
    for (const p of ps) {
      const options = p.kind === "rating" ? RATING_OPTIONS : p.options;
      const counts = options.map(() => 0);
      const mine = votes.filter((v) => v.pollId === p.id);
      for (const v of mine) {
        const c = v.choice as PollChoice;
        for (const i of p.kind === "rating" ? [Number(c) - 1] : Array.isArray(c) ? c : [c]) if (counts[i] !== undefined) counts[i]++;
      }
      options.forEach((o, i) => rows.push([p.question, p.kind, o, counts[i]!, mine.length ? (counts[i]! / mine.length).toFixed(3) : "0"]));
    }
  } else {
    const ws = await db
      .select({ w: metrics5s, slide: segments.label })
      .from(metrics5s)
      .leftJoin(segments, eq(segments.id, metrics5s.segmentId))
      .where(eq(metrics5s.sessionId, session.id))
      .orderBy(asc(metrics5s.bucket));
    rows = [
      ["time", "seconds_from_start", "slide", "active", "joined", "understanding", "engaged", "confused_share", "clarity", "questions", ...REACTIONS],
      ...ws.map(({ w, slide }) => [
        w.bucket.toISOString(),
        Math.round((w.bucket.getTime() - t0) / 1000),
        slide,
        w.active,
        w.joined,
        w.understanding,
        w.engaged.toFixed(3),
        w.confusedRatio.toFixed(3),
        w.avgRating,
        w.questionCount,
        ...REACTIONS.map((r) => Number(w.reactions[r] ?? 0)),
      ]),
    ];
  }

  return csvResponse(rows, `${fileSlug(session.title)}-${type}.csv`);
}
