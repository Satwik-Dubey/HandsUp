/**
 * Socket.IO contract between phones, the gateway and the teacher dashboard.
 * Students use namespace "/s", teachers use "/t" with a signed token.
 * Every client → server payload is validated with these schemas on the gateway.
 */
import { z } from "zod";
import { LIMITS, REACTIONS, type Reaction } from "./constants";
import { sessionInputsSchema } from "./schemas";

export const NAMESPACE = { student: "/s", teacher: "/t" } as const;

// ---------- phone → server ----------

export const joinPayload = z.object({
  code: z.string().min(4).max(12),
  deviceId: z.string().min(8).max(64),
  resumeToken: z.string().max(1024).optional(),
});
export type JoinPayload = z.infer<typeof joinPayload>;

const tapCount = z.number().int().min(0).max(LIMITS.maxTapsPerMessage);
export const reactPayload = z.object({
  seq: z.number().int().nonnegative(),
  counts: z
    .object(Object.fromEntries(REACTIONS.map((r) => [r, tapCount.optional()])) as Record<Reaction, z.ZodOptional<typeof tapCount>>)
    .strict(),
});
export type ReactPayload = z.infer<typeof reactPayload>;

export const ratePayload = z.object({
  seq: z.number().int().nonnegative(),
  value: z.number().int().min(1).max(5),
});
export type RatePayload = z.infer<typeof ratePayload>;

export const heartbeatPayload = z.object({ t: z.number() });

export const askPayload = z.object({ clientId: z.string().min(4).max(64), text: z.string().min(1).max(LIMITS.questionMaxLength) });
export const upvotePayload = z.object({ questionId: z.string().uuid() });
export const votePayload = z.object({ pollId: z.string().uuid(), choice: z.union([z.number(), z.array(z.number())]) });
export const idPayload = z.object({ id: z.string().uuid() });
export const pollIdPayload = z.object({ pollId: z.string().uuid() });
export const segmentPayload = z.object({ label: z.string().trim().max(60).optional() });

// ---------- server → phone ----------

export type JoinError = "not_found" | "ended" | "too_many_attempts" | "invalid" | "server_error";

export type JoinAck =
  | {
      ok: true;
      studentId: string;
      resumeToken: string;
      session: {
        id: string;
        title: string;
        status: "draft" | "live" | "ended";
        courseName: string;
        teacherName: string | null;
        inputs: z.infer<typeof sessionInputsSchema>;
      };
      /** The student's own last rating, so the 1–5 row shows it after a reload. */
      myRating: number | null;
      /** Highest seq the gateway has accepted from this device, so the phone can continue from there. */
      lastSeq: number;
      active: number;
      /** Questions this student asked and upvoted, so "Your question" and filled arrows survive a reload. */
      myQuestionIds: string[];
      myUpvoteIds: string[];
      questions: PublicQuestion[];
      activePoll: PollView | null;
      myPollChoice: PollChoice | null;
      pollResults: PollResults | null;
      segment: SegmentView | null;
    }
  | { ok: false; error: JoinError; title?: string };

export type ReactAck = { seq: number; ok: boolean; reason?: "rate_limited" | "not_live" | "duplicate" | "invalid" | "not_joined" };

export interface SessionStatusEvent {
  status: "draft" | "live" | "ended";
}
export interface SessionEndedEvent {
  thanksMessage?: string;
}
export interface PresenceEvent {
  active: number;
}

// ---------- questions ----------

export type QuestionStatus = "open" | "answered" | "pending" | "hidden";

/** What phones see: only open and answered questions. */
export interface PublicQuestion {
  id: string;
  text: string;
  votes: number;
  status: "open" | "answered";
  createdAt: number;
}

/** What the teacher sees: everything except hidden, plus questions waiting for review. */
export interface TeacherQuestion {
  id: string;
  text: string;
  votes: number;
  status: QuestionStatus;
  createdAt: number;
  segmentLabel: string | null;
  /** Group of similar questions this one belongs to (set by the NLP worker a moment after asking). */
  clusterId: string | null;
}

export interface TeacherQuestionsEvent {
  total: number;
  pending: number;
  answered: number;
  questions: TeacherQuestion[];
}

export type AskAck =
  | { ok: true; id: string; status: QuestionStatus }
  | { ok: false; reason: "profanity" | "rate_limited" | "disabled" | "not_live" | "invalid" | "not_joined" };

export type UpvoteAck = { ok: true; voted: boolean; votes: number } | { ok: false; reason: "not_found" | "not_live" | "not_joined" | "invalid" };

// ---------- polls ----------

export const POLL_KINDS = ["single", "multi", "rating"] as const;
export type PollKind = (typeof POLL_KINDS)[number];

export const POLL_KIND_META: Record<PollKind, { label: string; hint: string }> = {
  single: { label: "Multiple choice", hint: "Pick one answer" },
  multi: { label: "Pick several", hint: "Tick all that apply" },
  rating: { label: "Rating 1–5", hint: "e.g. Rate today's pace" },
};

export interface PollView {
  id: string;
  question: string;
  kind: PollKind;
  /** For rating polls this is ["1","2","3","4","5"]. */
  options: string[];
  openedAt: number | null;
  closedAt: number | null;
}

/** single: option index · multi: option indexes · rating: 1–5 */
export type PollChoice = number | number[];

export interface PollResults {
  pollId: string;
  /** Votes per option, same order as `options`. */
  counts: number[];
  voters: number;
}

export type VoteAck = { ok: true } | { ok: false; reason: "closed" | "invalid" | "not_live" | "not_joined" };

export const votePayloadFor = (kind: PollKind, options: number) => {
  if (kind === "rating") return z.number().int().min(1).max(5);
  if (kind === "single") return z.number().int().min(0).max(options - 1);
  return z
    .array(z.number().int().min(0).max(options - 1))
    .min(1)
    .max(options)
    .refine((a) => new Set(a).size === a.length);
};

// ---------- segments and windows ----------

export interface SegmentView {
  id: string;
  label: string;
  startsAt: number;
}

/** One 5-second timeline point, written by the aggregator worker. */
export interface WindowEvent {
  sessionId: string;
  bucket: number;
  active: number;
  joined: number;
  reactions: ReactionCounts;
  understanding: number | null;
  confusedRatio: number;
  engaged: number;
  avgRating: number | null;
  questionCount: number;
  segmentId: string | null;
}

// ---------- AI: question groups and insights ----------

/** A group of similar questions ("TLB vs page table · 12 similar"). */
export interface ClusterView {
  id: string;
  label: string;
  /** Questions in the group. */
  size: number;
  /** Questions plus their upvotes: roughly how many students want this answered. */
  people: number;
  /** The most upvoted question in the group. */
  sample: string;
  updatedAt: number;
}

export type InsightKind = "alert" | "suggestion" | "cluster" | "moment";
export type InsightSeverity = "info" | "warn" | "alert";
export type AlertRule = "engagement_drop" | "confusion_spike" | "hot_question" | "pace" | "understanding_drop";

export interface InsightView {
  id: string;
  at: number;
  kind: InsightKind;
  severity: InsightSeverity;
  message: string;
  /** Suggested next step, e.g. "Run a quick poll". */
  action: string | null;
  /** What the action button does on the dashboard. */
  actionKind: "poll" | "question" | null;
  rule: AlertRule | null;
  clusterId: string | null;
  segmentLabel: string | null;
  acknowledged: boolean;
}

/** Messages workers publish on rk.teacherChannel(sid); the gateway relays them to the teacher. */
export type TeacherChannelMessage =
  | { type: "window"; data: WindowEvent }
  | { type: "insight"; data: InsightView }
  | { type: "clusters"; data: ClusterView[] }
  /** Questions changed in the background (e.g. grouped): the gateway re-sends the lists. */
  | { type: "questions:changed" };

export type TeacherAck = { ok: true } | { ok: false; reason: string };

// ---------- server → teacher ----------

export type ReactionCounts = Record<Reaction, number>;

export interface TickEvent {
  t: number;
  status: "draft" | "live" | "ended";
  /** Students seen in the last 60 s. */
  active: number;
  /** Students who have ever joined this session. */
  joined: number;
  /** Share of active students who tapped anything in the last minute (0–1). */
  engaged: number;
  reactionsPerMin: number;
  /** Taps per kind in the last minute. */
  lastMinute: ReactionCounts;
  /** Taps per kind since the session started. */
  totals: ReactionCounts;
  /** Share of active students who tapped "confused" in the last minute (0–1). */
  confusedRatio: number;
  avgRating: number | null;
  ratingCount: number;
  /** 0–100, or null before there is enough signal. */
  understanding: number | null;
}

// ---------- typed maps for socket.io generics ----------

export interface StudentClientToServer {
  join: (p: JoinPayload, ack: (a: JoinAck) => void) => void;
  react: (p: ReactPayload, ack: (a: ReactAck) => void) => void;
  rate: (p: RatePayload, ack: (a: ReactAck) => void) => void;
  ask: (p: z.infer<typeof askPayload>, ack: (a: AskAck) => void) => void;
  upvote: (p: z.infer<typeof upvotePayload>, ack: (a: UpvoteAck) => void) => void;
  vote: (p: { pollId: string; choice: PollChoice }, ack: (a: VoteAck) => void) => void;
  hb: (p: { t: number }) => void;
}
export interface StudentServerToClient {
  "session:status": (e: SessionStatusEvent) => void;
  "session:ended": (e: SessionEndedEvent) => void;
  presence: (e: PresenceEvent) => void;
  "questions:top": (e: PublicQuestion[]) => void;
  "poll:open": (e: { poll: PollView }) => void;
  "poll:close": (e: { pollId: string; results?: PollResults }) => void;
  "poll:results": (e: PollResults) => void;
  segment: (e: SegmentView | null) => void;
}
export interface TeacherClientToServer {
  "tick:now": () => void;
  "question:answer": (p: { id: string }, ack: (a: TeacherAck) => void) => void;
  "question:hide": (p: { id: string }, ack: (a: TeacherAck) => void) => void;
  "question:approve": (p: { id: string }, ack: (a: TeacherAck) => void) => void;
  "question:reopen": (p: { id: string }, ack: (a: TeacherAck) => void) => void;
  "poll:launch": (p: { pollId: string }, ack: (a: TeacherAck) => void) => void;
  "poll:close": (p: { pollId: string }, ack: (a: TeacherAck) => void) => void;
  "segment:mark": (p: { label?: string }, ack: (a: TeacherAck) => void) => void;
  "insight:ack": (p: { id: string }, ack: (a: TeacherAck) => void) => void;
  "student:mute": (p: { id: string }, ack: (a: TeacherAck) => void) => void;
}
export interface TeacherServerToClient {
  tick: (e: TickEvent) => void;
  "session:status": (e: SessionStatusEvent) => void;
  window: (e: WindowEvent) => void;
  questions: (e: TeacherQuestionsEvent) => void;
  "question:new": (e: TeacherQuestion) => void;
  "poll:open": (e: { poll: PollView }) => void;
  "poll:close": (e: { pollId: string; results?: PollResults }) => void;
  "poll:results": (e: PollResults) => void;
  segment: (e: SegmentView | null) => void;
  clusters: (e: ClusterView[]) => void;
  insights: (e: InsightView[]) => void;
  "insight:new": (e: InsightView) => void;
  "insight:ack": (e: { id: string }) => void;
}

/** Messages the web app publishes on rk.controlChannel for the gateway. */
export type ControlMessage =
  | { type: "session:status"; sessionId: string; status: "draft" | "live" | "ended" }
  | { type: "session:updated"; sessionId: string }
  /** Ask the workers to fill a session with demo students. */
  | { type: "demo:start"; sessionId: string; code: string; count: number };

export function emptyCounts(): ReactionCounts {
  return Object.fromEntries(REACTIONS.map((r) => [r, 0])) as ReactionCounts;
}

/** Extra fields kept in `insights.payload`. */
export interface InsightPayload {
  action?: string | null;
  actionKind?: InsightView["actionKind"];
  rule?: AlertRule | null;
  clusterId?: string | null;
  segmentLabel?: string | null;
  [k: string]: unknown;
}

export function toInsightView(row: {
  id: string;
  at: Date;
  kind: InsightKind;
  severity: InsightSeverity;
  message: string;
  payload: InsightPayload | Record<string, unknown> | null;
  acknowledgedAt: Date | null;
}): InsightView {
  const p = (row.payload ?? {}) as InsightPayload;
  return {
    id: row.id,
    at: row.at.getTime(),
    kind: row.kind,
    severity: row.severity,
    message: row.message,
    action: p.action ?? null,
    actionKind: p.actionKind ?? null,
    rule: p.rule ?? null,
    clusterId: p.clusterId ?? null,
    segmentLabel: p.segmentLabel ?? null,
    acknowledged: row.acknowledgedAt !== null,
  };
}
