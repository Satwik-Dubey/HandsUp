"use client";

import type {
  ClusterView,
  InsightView,
  PollResults,
  PollView,
  SegmentView,
  TeacherQuestion,
  TeacherQuestionsEvent,
  TickEvent,
  WindowEvent,
} from "@handsup/shared";
import { create } from "zustand";

export type TimelinePoint = Pick<WindowEvent, "bucket" | "understanding" | "engaged" | "confusedRatio" | "active" | "segmentId">;

interface LiveState {
  connected: boolean;
  error: string | null;
  tick: TickEvent | null;
  /** 5-second windows from the server: history first, then live `window` events. */
  timeline: TimelinePoint[];
  segments: SegmentView[];
  segment: SegmentView | null;
  questions: TeacherQuestionsEvent;
  activePoll: PollView | null;
  results: Record<string, PollResults>;
  clusters: ClusterView[];
  /** Newest first. */
  insights: InsightView[];

  setConnected: (c: boolean, error?: string | null) => void;
  pushTick: (t: TickEvent) => void;
  loadHistory: (points: TimelinePoint[], segments: SegmentView[]) => void;
  pushWindow: (w: WindowEvent) => void;
  setSegment: (s: SegmentView | null) => void;
  setQuestions: (q: TeacherQuestionsEvent) => void;
  addQuestion: (q: TeacherQuestion) => void;
  setActivePoll: (p: PollView | null) => void;
  setResults: (r: PollResults) => void;
  setClusters: (c: ClusterView[]) => void;
  setInsights: (i: InsightView[]) => void;
  addInsight: (i: InsightView) => void;
  ackInsight: (id: string) => void;
  reset: () => void;
}

const empty = {
  connected: false,
  error: null,
  tick: null,
  timeline: [],
  segments: [],
  segment: null,
  questions: { total: 0, pending: 0, answered: 0, questions: [] },
  activePoll: null,
  results: {},
  clusters: [],
  insights: [],
};

export const useLive = create<LiveState>((set) => ({
  ...empty,
  setConnected: (connected, error = null) => set({ connected, error }),
  pushTick: (tick) => set({ tick }),
  loadHistory: (points, segments) =>
    set((s) => {
      // Merge with any windows that arrived over the socket while history was loading.
      const byBucket = new Map<number, TimelinePoint>();
      for (const p of [...points, ...s.timeline]) byBucket.set(p.bucket, p);
      const segById = new Map([...segments, ...s.segments].map((x) => [x.id, x]));
      return {
        timeline: [...byBucket.values()].sort((a, b) => a.bucket - b.bucket),
        segments: [...segById.values()].sort((a, b) => a.startsAt - b.startsAt),
      };
    }),
  pushWindow: (w) =>
    set((s) => {
      const last = s.timeline[s.timeline.length - 1];
      if (last && last.bucket >= w.bucket) return {};
      return { timeline: [...s.timeline, w] };
    }),
  setSegment: (segment) =>
    set((s) => ({
      segment,
      segments: segment && !s.segments.some((x) => x.id === segment.id) ? [...s.segments, segment] : s.segments,
    })),
  setQuestions: (questions) => set({ questions }),
  addQuestion: (q) =>
    set((s) =>
      s.questions.questions.some((x) => x.id === q.id)
        ? {}
        : {
            questions: {
              ...s.questions,
              total: s.questions.total + 1,
              pending: s.questions.pending + (q.status === "pending" ? 1 : 0),
              questions: [q, ...s.questions.questions],
            },
          },
    ),
  setActivePoll: (activePoll) => set({ activePoll }),
  setResults: (r) => set((s) => ({ results: { ...s.results, [r.pollId]: r } })),
  setClusters: (clusters) => set({ clusters }),
  setInsights: (insights) => set({ insights }),
  addInsight: (i) => set((s) => (s.insights.some((x) => x.id === i.id) ? {} : { insights: [i, ...s.insights].slice(0, 50) })),
  ackInsight: (id) => set((s) => ({ insights: s.insights.map((x) => (x.id === id ? { ...x, acknowledged: true } : x)) })),
  reset: () => set(empty),
}));
