import type { ReportStats, TopQuestionGroup } from "@handsup/shared";

/** One ended lecture as the term report sees it. */
export interface TermLecture {
  id: string;
  title: string;
  date: number;
  stats: ReportStats | null;
  summary: string | null;
  topQuestions: TopQuestionGroup[];
}

export interface TermSummary {
  lectures: number;
  first: number | null;
  last: number | null;
  avgUnderstanding: number | null;
  avgEngaged: number | null;
  avgClarity: number | null;
  avgPeakAudience: number | null;
  questions: number;
  answered: number;
  best: TermLecture | null;
  hardest: TermLecture | null;
  /** The biggest fall in understanding from one lecture to the next. */
  biggestDrop: { from: TermLecture; to: TermLecture; points: number } | null;
  mostQuestions: TermLecture | null;
  /** Question topics across the term, merged by label, most people first. */
  topics: { label: string; people: number; lectures: string[] }[];
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Term-level numbers and highlights from a course's ended lectures (any order in, oldest first inside). */
export function summarizeTerm(input: TermLecture[]): TermSummary {
  const lectures = [...input].sort((a, b) => a.date - b.date);
  const withStats = lectures.filter((l): l is TermLecture & { stats: ReportStats } => l.stats !== null);
  const scored = withStats.filter((l) => l.stats.avgUnderstanding !== null);
  const by = (f: (l: (typeof withStats)[number]) => number | null) => withStats.map(f).filter((x): x is number => x !== null);

  let biggestDrop: TermSummary["biggestDrop"] = null;
  for (let i = 1; i < scored.length; i++) {
    const points = scored[i - 1]!.stats.avgUnderstanding! - scored[i]!.stats.avgUnderstanding!;
    if (points > 0 && (!biggestDrop || points > biggestDrop.points)) biggestDrop = { from: scored[i - 1]!, to: scored[i]!, points };
  }

  const topics = new Map<string, { label: string; people: number; lectures: string[] }>();
  for (const l of lectures)
    for (const q of l.topQuestions) {
      const key = q.label.trim().toLowerCase();
      if (!key) continue;
      const t = topics.get(key) ?? { label: q.label.trim(), people: 0, lectures: [] };
      t.people += q.people;
      if (!t.lectures.includes(l.title)) t.lectures.push(l.title);
      topics.set(key, t);
    }

  const round = (x: number | null, k = 1) => (x === null ? null : Math.round(x * k) / k);
  return {
    lectures: lectures.length,
    first: lectures[0]?.date ?? null,
    last: lectures.at(-1)?.date ?? null,
    avgUnderstanding: round(avg(by((l) => l.stats.avgUnderstanding))),
    avgEngaged: round(avg(by((l) => l.stats.avgEngaged)), 1000),
    avgClarity: round(avg(by((l) => l.stats.clarity)), 10),
    avgPeakAudience: round(avg(by((l) => l.stats.peakAudience))),
    questions: withStats.reduce((a, l) => a + l.stats.questions, 0),
    answered: withStats.reduce((a, l) => a + l.stats.answered, 0),
    best: scored.length ? scored.reduce((a, b) => (b.stats.avgUnderstanding! > a.stats.avgUnderstanding! ? b : a)) : null,
    hardest: scored.length ? scored.reduce((a, b) => (b.stats.avgUnderstanding! < a.stats.avgUnderstanding! ? b : a)) : null,
    biggestDrop,
    mostQuestions: withStats.length ? withStats.reduce((a, b) => (b.stats.questions > a.stats.questions ? b : a)) : null,
    topics: [...topics.values()].sort((a, b) => b.people - a.people).slice(0, 8),
  };
}

/** The first one or two sentences of a lecture summary, for the lecture-by-lecture list. */
export function firstSentences(text: string | null, n = 2): string {
  if (!text) return "";
  const parts = text.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text];
  return parts.slice(0, n).join("").trim();
}
