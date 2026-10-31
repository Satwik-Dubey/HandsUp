"use client";

import { ChevronUp, Trophy } from "lucide-react";
import { IconBadge } from "@/components/icons";
import { trendingWords, type ClusterView, type TeacherQuestion, type TeacherQuestionsEvent } from "@handsup/shared";
import { useMemo } from "react";

type Action = "question:answer" | "question:hide" | "question:approve" | "question:reopen" | "student:mute";
export type QuestionsTab = "top" | "new" | "groups" | "review";

const PODIUM = ["bg-sun", "bg-sky", "bg-pink"];

function ago(t: number) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} h ago`;
}

export function QuestionsPanel({
  data,
  clusters,
  onAction,
  reviewOn,
  onToggleReview,
  tab,
  setTab,
  focus,
  setFocus,
}: {
  data: TeacherQuestionsEvent;
  clusters: ClusterView[];
  onAction: (a: Action, id: string) => void;
  reviewOn: boolean;
  onToggleReview: (on: boolean) => void;
  tab: QuestionsTab;
  setTab: (t: QuestionsTab) => void;
  /** Show only the questions of this group. */
  focus: string | null;
  setFocus: (id: string | null) => void;
}) {
  const visible = data.questions.filter((q) => q.status !== "pending");
  const pending = data.questions.filter((q) => q.status === "pending");
  const top = [...visible].filter((q) => q.status === "open").sort((a, b) => b.votes - a.votes || b.createdAt - a.createdAt);
  const sizeOf = useMemo(() => new Map(clusters.map((c) => [c.id, c])), [clusters]);
  const trending = useMemo(() => trendingWords(visible.slice(0, 150).map((q) => q.text), 8), [visible]);
  const focused = focus ? sizeOf.get(focus) : null;
  let list = tab === "top" ? top : tab === "new" ? [...visible].sort((a, b) => b.createdAt - a.createdAt) : tab === "review" ? pending : [];
  if (focus) list = [...visible].filter((q) => q.clusterId === focus).sort((a, b) => b.votes - a.votes);

  return (
    <section className="card flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2.5 text-xl font-semibold">
          <IconBadge icon={Trophy} tone="sun" size="sm" /> Questions
        </h2>
        <span className="text-sm text-muted">
          {data.total} asked · {data.answered} answered
        </span>
      </div>

      {top.length > 0 && (
        <ol className="grid grid-cols-3 items-end gap-2" aria-label="Top three questions">
          {[1, 0, 2].map((rank) => {
            const q = top[rank];
            if (!q) return <li key={rank} />;
            return (
              <li key={`${rank}-${q.id}`} className="flex flex-col items-center gap-1 text-center">
                <span className="line-clamp-2 text-sm font-medium">{q.text}</span>
                <span className="text-xs text-muted">{q.votes} votes</span>
                <span
                  className={`flex w-full origin-bottom animate-grow-y items-start justify-center rounded-t-2xl pt-2 text-2xl font-semibold text-[#121212] ${PODIUM[rank]}`}
                  style={{ height: [72, 52, 40][rank] }}
                >
                  {rank + 1}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {trending.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-muted">Trending</span>
          {trending.map((w) => (
            <span key={w.word} className="rounded-full bg-paper px-2.5 py-0.5">
              {w.word} <span className="text-muted">{w.count}</span>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-1 rounded-full bg-paper p-1 text-sm">
        {(["top", "new", "groups", ...(reviewOn || pending.length ? (["review"] as const) : [])] as QuestionsTab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setFocus(null);
            }}
            className={`flex-1 rounded-full px-2 py-1.5 font-medium ${tab === t && !focus ? "bg-ink text-on-ink" : ""}`}
          >
            {t === "top" ? "Top" : t === "new" ? "Newest" : t === "groups" ? `Groups${clusters.length ? ` (${clusters.length})` : ""}` : `Review${pending.length ? ` (${pending.length})` : ""}`}
          </button>
        ))}
      </div>

      {focus && (
        <div className="flex items-center justify-between rounded-2xl bg-sun/30 px-4 py-2">
          <span>
            <b>{focused?.label ?? "Group"}</b> · {focused ? `${focused.people} ${focused.people === 1 ? "student" : "students"}` : ""}
          </span>
          <button className="text-sm underline" onClick={() => setFocus(null)}>
            Show all
          </button>
        </div>
      )}

      {tab === "groups" && !focus ? (
        clusters.length === 0 ? (
          <p className="py-6 text-center text-muted">Similar questions are grouped here automatically as students ask them.</p>
        ) : (
          <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
            {clusters.map((c, i) => (
              <li key={c.id}>
                <button className="flex w-full items-center gap-3 rounded-2xl bg-paper p-3 text-left hover:bg-line/40" onClick={() => setFocus(c.id)}>
                  <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-full font-semibold text-[#121212] ${PODIUM[i] ?? "bg-card"}`}>
                    {c.people}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{c.label}</span>
                    <span className="block truncate text-sm text-muted">“{c.sample}” · {c.size} similar</span>
                  </span>
                  <span className="text-muted">›</span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : list.length === 0 ? (
        <p className="py-6 text-center text-muted">
          {tab === "review" ? "Nothing waiting for review." : "No questions yet. Students ask from the Questions tab on their phone."}
        </p>
      ) : (
        <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
          {list.map((q) => (
            <QuestionRow key={q.id} q={q} group={q.clusterId ? sizeOf.get(q.clusterId) : undefined} onAction={onAction} onGroup={setFocus} />
          ))}
        </ul>
      )}

      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={reviewOn} onChange={(e) => onToggleReview(e.target.checked)} />
        Review questions before students see them
      </label>
    </section>
  );
}

function QuestionRow({
  q,
  group,
  onAction,
  onGroup,
}: {
  q: TeacherQuestion;
  group?: ClusterView;
  onAction: (a: Action, id: string) => void;
  onGroup: (id: string) => void;
}) {
  return (
    <li className={`flex animate-slide-in items-start gap-3 rounded-2xl p-3 ${q.status === "answered" ? "bg-paper opacity-70" : "bg-paper"}`}>
      <span className="flex w-10 flex-none flex-col items-center rounded-xl bg-card py-1 font-semibold tabular-nums">
        <ChevronUp size={14} strokeWidth={2.75} className="text-muted" aria-hidden />
        {q.votes}
      </span>
      <div className="min-w-0 flex-1">
        <p className={q.status === "answered" ? "line-through decoration-1" : ""}>{q.text}</p>
        <p className="text-xs text-muted">
          {ago(q.createdAt)}
          {q.segmentLabel ? ` · ${q.segmentLabel}` : ""}
          {q.status === "answered" ? " · answered" : ""}
        </p>
        {group && (
          <button className="mt-1 rounded-full bg-sun/40 px-2 py-0.5 text-xs font-semibold" onClick={() => onGroup(group.id)}>
            {group.label} · {group.size} similar
          </button>
        )}
      </div>
      <div className="flex flex-none flex-col gap-1 text-sm">
        {q.status === "pending" && (
          <button className="rounded-full bg-forest px-3 py-1 font-semibold text-white" onClick={() => onAction("question:approve", q.id)}>
            Show
          </button>
        )}
        {q.status === "open" && (
          <button className="rounded-full bg-ink px-3 py-1 font-semibold text-on-ink" onClick={() => onAction("question:answer", q.id)}>
            Answered
          </button>
        )}
        {q.status === "answered" && (
          <button className="rounded-full bg-card px-3 py-1" onClick={() => onAction("question:reopen", q.id)}>
            Reopen
          </button>
        )}
        <button className="rounded-full px-3 py-1 text-muted hover:text-coral" onClick={() => onAction("question:hide", q.id)}>
          Hide
        </button>
        <button
          className="rounded-full px-3 py-1 text-xs text-muted hover:text-coral"
          title="Hide everything this student asked, and hide their future questions"
          onClick={() => window.confirm("Mute this student? Everything they asked is hidden, and their new questions won't appear.") && onAction("student:mute", q.id)}
        >
          Mute
        </button>
      </div>
    </li>
  );
}
