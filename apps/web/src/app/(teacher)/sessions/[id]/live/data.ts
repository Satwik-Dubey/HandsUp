import "server-only";
import { asc, eq, inArray, pollVotes, polls as pollsTable } from "@handsup/db";
import { RATING_OPTIONS, type PollChoice, type PollResults } from "@handsup/shared";
import { db } from "@/lib/db";
import { requireOwnedSession } from "@/lib/teacher";
import { appUrl } from "@/lib/utils";
import type { DashboardPoll } from "./LiveDashboard";

/** Everything the dashboard needs on first render. Also used by presenter mode. */
export async function loadDashboard(id: string) {
  const { session, course } = await requireOwnedSession(id);
  const polls = await db.query.polls.findMany({
    where: eq(pollsTable.sessionId, session.id),
    orderBy: [asc(pollsTable.position), asc(pollsTable.createdAt)],
  });

  // Final results for polls that already ran, so they show after a reload.
  const votes = polls.length
    ? await db
        .select({ pollId: pollVotes.pollId, choice: pollVotes.choice })
        .from(pollVotes)
        .where(
          inArray(
            pollVotes.pollId,
            polls.map((p) => p.id),
          ),
        )
    : [];
  const dashboardPolls: DashboardPoll[] = polls.map((p) => {
    const options = p.kind === "rating" ? RATING_OPTIONS : p.options;
    const results: PollResults = { pollId: p.id, counts: options.map(() => 0), voters: 0 };
    for (const v of votes.filter((v) => v.pollId === p.id)) {
      results.voters++;
      const c = v.choice as PollChoice;
      for (const i of p.kind === "rating" ? [Number(c) - 1] : Array.isArray(c) ? c : [c]) if (results.counts[i] !== undefined) results.counts[i]++;
    }
    return { id: p.id, question: p.question, kind: p.kind, options, openedAt: p.openedAt?.getTime() ?? null, closedAt: p.closedAt?.getTime() ?? null, results };
  });

  return {
    session: {
      id: session.id,
      title: session.title,
      code: session.joinCode,
      status: session.status,
      startedAt: session.startedAt?.toISOString() ?? null,
      endedAt: session.endedAt?.toISOString() ?? null,
      reviewQuestionsFirst: Boolean(session.settings?.reviewQuestionsFirst),
    },
    course: { id: course.id, name: course.name },
    joinUrl: `${appUrl()}/j/${session.joinCode}`,
    polls: dashboardPolls,
  };
}
