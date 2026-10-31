import type { ReportStats } from "@handsup/shared";
import { describe, expect, it } from "vitest";
import { firstSentences, summarizeTerm, type TermLecture } from "@/lib/term";

const stats = (p: Partial<ReportStats>): ReportStats => ({
  durationMin: 50,
  peakAudience: 40,
  joined: 42,
  avgEngaged: 0.8,
  avgUnderstanding: 70,
  clarity: 4,
  questions: 5,
  answered: 2,
  polls: 1,
  reactions: {},
  ...p,
});
const lecture = (n: number, p: Partial<ReportStats>, topics: [string, number][] = []): TermLecture => ({
  id: `l${n}`,
  title: `Lecture ${n}`,
  date: Date.UTC(2026, 8, n),
  stats: stats(p),
  summary: `Summary ${n}. More detail. Even more.`,
  topQuestions: topics.map(([label, people]) => ({ label, people, size: people, sample: label })),
});

describe("term report", () => {
  const lectures = [
    lecture(3, { avgUnderstanding: 55, questions: 20 }, [["TLB", 12]]),
    lecture(1, { avgUnderstanding: 80 }, [["TLB", 4], ["midterm", 6]]),
    lecture(2, { avgUnderstanding: 75 }),
  ];
  const t = summarizeTerm(lectures);

  it("counts and averages across lectures", () => {
    expect(t.lectures).toBe(3);
    expect(t.avgUnderstanding).toBe(70);
    expect(t.questions).toBe(30);
    expect(t.first).toBe(Date.UTC(2026, 8, 1));
  });

  it("finds the best, hardest and biggest drop in date order", () => {
    expect(t.best?.id).toBe("l1");
    expect(t.hardest?.id).toBe("l3");
    expect(t.biggestDrop).toMatchObject({ points: 20 });
    expect(t.biggestDrop?.from.id).toBe("l2");
    expect(t.mostQuestions?.id).toBe("l3");
  });

  it("merges question topics across lectures", () => {
    expect(t.topics[0]).toEqual({ label: "TLB", people: 16, lectures: ["Lecture 1", "Lecture 3"] });
  });

  it("copes with no lectures", () => {
    const empty = summarizeTerm([]);
    expect(empty.lectures).toBe(0);
    expect(empty.avgUnderstanding).toBeNull();
    expect(empty.best).toBeNull();
  });

  it("shortens summaries to their first sentences", () => {
    expect(firstSentences("One. Two! Three?")).toBe("One. Two!");
    expect(firstSentences(null)).toBe("");
  });
});
