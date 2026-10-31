/**
 * Report worker: writes the after-class report within a minute of "End class".
 *
 * It looks for ended sessions without a finished report (or with "Regenerate" pressed),
 * computes stats, key moments, the most-asked questions and a per-slide summary from the
 * 5-second windows, then asks Gemini Flash for a short written summary. Without a Gemini key
 * the summary is written from the same numbers by rules.
 */
import {
  and,
  courses,
  desc,
  eq,
  getDb,
  insights,
  isNull,
  metrics5s,
  pollVotes,
  polls,
  questions,
  reports,
  segments,
  sessions,
  sql,
  students,
} from "@handsup/db";
import { createRedis } from "@handsup/server";
import {
  REACTIONS,
  REACTION_META,
  emptyCounts,
  formatOffset,
  mean,
  rk,
  stripPersonalDetails,
  type InsightPayload,
  type KeyMoment,
  type ReportStats,
  type SegmentSummary,
  type TopQuestionGroup,
} from "@handsup/shared";
import { geminiText } from "./ai/llm";
import { env } from "./env";
import { loadClusters } from "./nlp";

const db = getDb(env.databaseUrl);
const redis = createRedis(env.redisUrl, "report");
const MIN = 60_000;

interface Win {
  t: number;
  active: number;
  joined: number;
  engaged: number;
  confusedRatio: number;
  understanding: number | null;
  avgRating: number | null;
  reactions: Record<string, number>;
  segmentId: string | null;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Rolling 1-minute average of understanding, so a single noisy window can't be "the peak". */
function smoothed(wins: Win[]): { t: number; u: number }[] {
  const out: { t: number; u: number }[] = [];
  for (let i = 0; i < wins.length; i++) {
    const span = wins.slice(Math.max(0, i - 11), i + 1).map((w) => w.understanding).filter((u): u is number => u !== null);
    if (span.length >= 6) out.push({ t: wins[i]!.t, u: mean(span) });
  }
  return out;
}

export async function buildReport(sid: string) {
  const s = await db.query.sessions.findFirst({ where: eq(sessions.id, sid) });
  if (!s) return;
  const course = await db.query.courses.findFirst({ where: eq(courses.id, s.courseId), columns: { name: true } });
  const start = (s.startedAt ?? s.createdAt).getTime();
  const end = (s.endedAt ?? new Date()).getTime();

  const [winRows, segRows, qRows, pollRows, alertRows, [{ n: joinedCount } = { n: 0 }]] = await Promise.all([
    db.select().from(metrics5s).where(eq(metrics5s.sessionId, sid)).orderBy(metrics5s.bucket),
    db.select().from(segments).where(eq(segments.sessionId, sid)).orderBy(segments.startsAt),
    db
      .select({ id: questions.id, body: questions.body, upvotes: questions.upvotes, status: questions.status, clusterId: questions.clusterId, segmentId: questions.segmentId })
      .from(questions)
      .where(eq(questions.sessionId, sid)),
    db.select().from(polls).where(and(eq(polls.sessionId, sid), sql`${polls.openedAt} is not null`)).orderBy(polls.openedAt),
    db.select().from(insights).where(and(eq(insights.sessionId, sid), eq(insights.kind, "alert"))).orderBy(insights.at),
    db.select({ n: sql<number>`count(*)::int` }).from(students).where(eq(students.sessionId, sid)),
  ]);
  const wins: Win[] = winRows.map((w) => ({ ...w, t: w.bucket.getTime() }));
  const visibleQs = qRows.filter((q) => q.status !== "hidden");

  // ---------- stats ----------
  const reactions = emptyCounts() as Record<string, number>;
  for (const w of wins) for (const r of REACTIONS) reactions[r]! += Number(w.reactions[r] ?? 0);
  const withPeople = wins.filter((w) => w.active > 0);
  const us = wins.map((w) => w.understanding).filter((u): u is number => u !== null);
  const lastRating = [...wins].reverse().find((w) => w.avgRating !== null)?.avgRating ?? null;
  const stats: ReportStats = {
    durationMin: Math.max(0, Math.round((end - start) / MIN)),
    peakAudience: Math.max(0, ...wins.map((w) => w.active)),
    joined: Math.max(joinedCount, ...wins.map((w) => w.joined), 0),
    avgEngaged: withPeople.length ? round1(mean(withPeople.map((w) => w.engaged)) * 100) / 100 : null,
    avgUnderstanding: us.length ? Math.round(mean(us)) : null,
    clarity: lastRating !== null ? round1(lastRating) : null,
    questions: visibleQs.length,
    answered: visibleQs.filter((q) => q.status === "answered").length,
    polls: pollRows.length,
    reactions,
  };

  // ---------- per slide ----------
  const segSummaries: SegmentSummary[] = segRows.map((seg, i) => {
    const from = seg.startsAt.getTime();
    const to = segRows[i + 1]?.startsAt.getTime() ?? Infinity;
    const ws = wins.filter((w) => w.t >= from && w.t < to);
    const u = ws.map((w) => w.understanding).filter((x): x is number => x !== null);
    return {
      label: seg.label,
      startsAtMs: from - start,
      avgUnderstanding: u.length ? Math.round(mean(u)) : null,
      confusedPeak: ws.length ? Math.max(...ws.map((w) => w.confusedRatio)) : 0,
      questions: qRows.filter((q) => q.segmentId === seg.id).length,
    };
  });
  const segLabelAt = (t: number) => [...segRows].reverse().find((sg) => sg.startsAt.getTime() <= t)?.label ?? null;

  // ---------- key moments ----------
  const moments: KeyMoment[] = [];
  const smooth = smoothed(wins);
  if (smooth.length) {
    const peak = smooth.reduce((a, b) => (b.u > a.u ? b : a));
    const seg = segLabelAt(peak.t);
    moments.push({ offsetMs: peak.t - start, kind: "peak", title: `Understanding peak${seg ? ` · ${seg}` : ""}`, detail: `Understanding reached ${Math.round(peak.u)}.` });
  }
  const uAt = (t: number) => smooth.filter((p) => p.t <= t).pop()?.u ?? null;
  // Alerts become moments: the first alert of each kind in any 5-minute stretch, most important kinds first, at most 6.
  const PRIORITY = ["confusion_spike", "understanding_drop", "hot_question", "engagement_drop", "pace"];
  const TITLES: Record<string, string> = {
    confusion_spike: "Confusion spike",
    understanding_drop: "Understanding drop",
    hot_question: "Hot question",
    engagement_drop: "Engagement drop",
    pace: "Pace",
  };
  const lastByRule = new Map<string, number>();
  const picked: { t: number; rule: string; p: InsightPayload; message: string }[] = [];
  for (const a of alertRows) {
    const p = (a.payload ?? {}) as InsightPayload;
    const rule = p.rule ?? "pace";
    const t = a.at.getTime();
    if (t - (lastByRule.get(rule) ?? -Infinity) < 5 * MIN) continue;
    lastByRule.set(rule, t);
    picked.push({ t, rule, p, message: a.message });
  }
  picked.sort((x, y) => PRIORITY.indexOf(x.rule) - PRIORITY.indexOf(y.rule) || x.t - y.t);
  for (const { t, rule, p, message } of picked.slice(0, 6)) {
    const kind: KeyMoment["kind"] = rule === "confusion_spike" || rule === "hot_question" ? "confusion" : rule === "pace" ? "pace" : "drop";
    moments.push({ offsetMs: t - start, kind, title: `${TITLES[rule] ?? "Alert"}${p.segmentLabel ? ` · ${p.segmentLabel}` : ""}`, detail: message });

    // Recovery: understanding climbs ≥ 15 points within 6 minutes of a confusion or drop alert.
    const before = uAt(t);
    if (before !== null && kind !== "pace" && !moments.some((m) => m.kind === "recovery" && Math.abs(m.offsetMs - (t - start)) < 6 * MIN)) {
      const after = smooth.find((pt) => pt.t > t && pt.t <= t + 6 * MIN && pt.u >= before + 15);
      if (after) moments.push({ offsetMs: after.t - start, kind: "recovery", title: "Recovery", detail: `Understanding came back to ${Math.round(after.u)}.` });
    }
  }
  for (const poll of pollRows) {
    const votes = await db.select({ choice: pollVotes.choice }).from(pollVotes).where(eq(pollVotes.pollId, poll.id));
    if (!votes.length) continue;
    let detail: string;
    if (poll.kind === "rating") {
      detail = `Average ${round1(mean(votes.map((v) => Number(v.choice))))} / 5 from ${votes.length} votes.`;
    } else {
      const counts = poll.options.map(() => 0);
      for (const v of votes) for (const c of Array.isArray(v.choice) ? (v.choice as number[]) : [v.choice as number]) if (counts[c] !== undefined) counts[c]++;
      const top = counts.indexOf(Math.max(...counts));
      detail = `${Math.round((counts[top]! / votes.length) * 100)}% picked “${poll.options[top]}” (${votes.length} votes).`;
    }
    moments.push({ offsetMs: poll.openedAt!.getTime() - start, kind: "poll", title: `Poll: ${poll.question}`, detail });
  }
  moments.sort((a, b) => a.offsetMs - b.offsetMs);

  // ---------- most asked ----------
  const groups = await loadClusters(sid);
  const top: TopQuestionGroup[] = groups.slice(0, 5).map((g) => ({ label: g.label, people: g.people, size: g.size, sample: g.sample }));
  const grouped = new Set(groups.map((g) => g.id));
  for (const q of [...visibleQs].filter((q) => !q.clusterId || !grouped.has(q.clusterId)).sort((a, b) => b.upvotes - a.upvotes)) {
    if (top.length >= 5) break;
    top.push({ label: q.body.length > 48 ? `${q.body.slice(0, 46)}…` : q.body, people: q.upvotes + 1, size: 1, sample: q.body });
  }
  top.sort((a, b) => b.people - a.people);

  // ---------- written summary ----------
  const facts = {
    lecture: s.title,
    course: course?.name ?? "",
    stats: { ...stats, avgEngagedPercent: stats.avgEngaged === null ? null : Math.round(stats.avgEngaged * 100) },
    keyMoments: moments.map((m) => `${formatOffset(m.offsetMs)} ${m.title}: ${m.detail}`),
    perSlide: segSummaries.map((sg) => `${sg.label}: understanding ${sg.avgUnderstanding ?? "n/a"}, confused peak ${Math.round(sg.confusedPeak * 100)}%, ${sg.questions} questions`),
    mostAsked: top.map((q) => `${q.label} (${q.people} students) e.g. "${stripPersonalDetails(q.sample)}"`),
  };
  let summary: string | null = null;
  let source: "gemini" | "template" = "template";
  if (stats.peakAudience > 0 || visibleQs.length > 0) {
    summary = await geminiText(
      `You write the after-class recap for a university teacher. Using ONLY the data below, write 4-6 sentences in plain, warm, direct English addressed to the teacher ("you").
Cover: how the class went overall, the high point, where students got lost and why (use the slide names and question topics), what helped them recover, and one concrete thing to do next lecture. Use numbers from the data. No headings, no bullet points, no emoji.

DATA:
${JSON.stringify(facts, null, 1)}`,
    );
    if (summary) source = "gemini";
  }
  summary ??= templateSummary(stats, moments, segSummaries, top);

  const values = {
    summaryMd: summary,
    keyMoments: moments,
    topQuestions: top,
    stats: stats as unknown as Record<string, unknown>,
    segments: segSummaries,
    summarySource: source,
    generatedAt: new Date(),
  };
  await db.insert(reports).values({ sessionId: sid, ...values }).onConflictDoUpdate({ target: reports.sessionId, set: values });
  console.log(`[report] ${sid.slice(0, 8)} "${s.title}" ready (${source})`);
}

function templateSummary(st: ReportStats, moments: KeyMoment[], segs: SegmentSummary[], top: TopQuestionGroup[]): string {
  if (st.peakAudience === 0 && st.questions === 0) return "No students took part in this lecture, so there's nothing to summarize yet.";
  const parts: string[] = [];
  parts.push(
    `${st.joined} students joined over ${st.durationMin} minutes, with up to ${st.peakAudience} active at once` +
      (st.avgUnderstanding !== null ? ` and an average understanding of ${st.avgUnderstanding}/100.` : "."),
  );
  const peak = moments.find((m) => m.kind === "peak");
  if (peak) parts.push(`The high point came at ${formatOffset(peak.offsetMs)} (${peak.title.replace("Understanding peak · ", "")}).`);
  const lows = segs.filter((sg) => sg.avgUnderstanding !== null).sort((a, b) => a.avgUnderstanding! - b.avgUnderstanding!);
  const confusion =
    moments.find((m) => m.title.startsWith("Confusion spike")) ?? moments.find((m) => m.kind === "drop") ?? moments.find((m) => m.kind === "confusion");
  if (lows.length > 1) parts.push(`Students found ${lows[0]!.label} hardest (understanding ${lows[0]!.avgUnderstanding}).`);
  else if (confusion) parts.push(`The hardest moment was at ${formatOffset(confusion.offsetMs)}: ${confusion.detail}`);
  if (moments.some((m) => m.kind === "recovery")) parts.push("Understanding recovered afterwards, so whatever you did next worked.");
  if (top[0]) parts.push(`The most asked topic was “${top[0].label}” (${top[0].people} ${top[0].people === 1 ? "student" : "students"}).`);
  const most = REACTIONS.reduce((a, r) => (st.reactions[r]! > st.reactions[a]! ? r : a), REACTIONS[0]);
  if (st.reactions[most]) parts.push(`The most tapped reaction was ${REACTION_META[most].label}.`);
  if (top[0]) parts.push(`Next time, start by answering “${top[0].label}”.`);
  return parts.join(" ");
}

async function sweep() {
  const due = await db
    .select({ id: sessions.id })
    .from(sessions)
    .leftJoin(reports, eq(reports.sessionId, sessions.id))
    .where(and(eq(sessions.status, "ended"), isNull(reports.generatedAt), sql`${sessions.endedAt} > now() - interval '30 days'`,
        // Give the aggregator a moment to close the last windows.
        sql`${sessions.endedAt} < now() - interval '8 seconds'`,
      ))
    .orderBy(desc(sessions.endedAt))
    .limit(5);
  for (const { id } of due) {
    if ((await redis.set(rk.reportLock(id), env.consumerName, "PX", 120_000, "NX")) !== "OK") continue;
    try {
      await buildReport(id);
    } catch (e) {
      console.error("[report]", id, (e as Error).message);
      // Write a minimal report so the page doesn't wait forever; "Regenerate" retries.
      await db
        .insert(reports)
        .values({ sessionId: id, summaryMd: "The report couldn't be generated. Press Regenerate to try again.", generatedAt: new Date(), summarySource: "template" })
        .onConflictDoNothing();
    } finally {
      await redis.del(rk.reportLock(id));
    }
  }
}

export function startReports() {
  let busy = false;
  setInterval(() => {
    if (busy) return;
    busy = true;
    sweep()
      .catch((e) => console.error("[report]", (e as Error).message))
      .finally(() => (busy = false));
  }, 5000);
  console.log(`[report] after-class reports on${env.geminiApiKey ? ` with Gemini (${env.geminiModel})` : " (add GEMINI_API_KEY for AI-written summaries)"}`);
}

export async function stopReports() {
  await redis.quit().catch(() => {});
}
