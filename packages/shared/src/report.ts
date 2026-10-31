/** Shapes stored in the `reports` table and shown on the report page. */

export interface ReportStats {
  durationMin: number;
  peakAudience: number;
  joined: number;
  /** Average share of active students who reacted (0–1). */
  avgEngaged: number | null;
  avgUnderstanding: number | null;
  /** Average clarity rating, 1–5. */
  clarity: number | null;
  questions: number;
  answered: number;
  polls: number;
  reactions: Record<string, number>;
}

export interface KeyMoment {
  /** Milliseconds since the lecture started. */
  offsetMs: number;
  kind: "peak" | "confusion" | "poll" | "recovery" | "drop" | "pace";
  title: string;
  detail: string;
}

export interface TopQuestionGroup {
  label: string;
  /** Students asking or upvoting. */
  people: number;
  size: number;
  sample: string;
}

export interface SegmentSummary {
  label: string;
  startsAtMs: number;
  avgUnderstanding: number | null;
  confusedPeak: number;
  questions: number;
}

export interface ReportView {
  sessionId: string;
  title: string;
  courseName: string;
  startedAt: number | null;
  endedAt: number | null;
  summaryMd: string | null;
  /** "gemini" when written by the model, "template" when generated without AI. */
  summarySource: "gemini" | "template" | null;
  stats: ReportStats | null;
  keyMoments: KeyMoment[];
  topQuestions: TopQuestionGroup[];
  segments: SegmentSummary[];
  generatedAt: number | null;
}

export function formatOffset(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
