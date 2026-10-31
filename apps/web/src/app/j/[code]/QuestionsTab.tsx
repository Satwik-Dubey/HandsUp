"use client";

import { ArrowUp, Check, ChevronUp, Trophy } from "lucide-react";
import { Ico } from "@/components/icons";
import { LIMITS, type PublicQuestion } from "@handsup/shared";
import { useState } from "react";

const PODIUM = [
  { bg: "bg-sun", h: 96 },
  { bg: "bg-sky", h: 72 },
  { bg: "bg-pink", h: 56 },
];

/** Ask a question and upvote classmates'. The template's leaderboard becomes a Top Questions podium. */
export function QuestionsTab({
  questions,
  mine,
  upvoted,
  onAsk,
  onUpvote,
}: {
  questions: PublicQuestion[];
  mine: Set<string>;
  upvoted: Set<string>;
  onAsk: (text: string) => Promise<boolean>;
  onUpvote: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const open = questions.filter((q) => q.status === "open");
  const top = open.slice(0, 3);
  const rest = [...open.slice(3), ...questions.filter((q) => q.status === "answered")];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 2 || sending) return;
    setSending(true);
    if (await onAsk(text.trim())) setText("");
    setSending(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={submit} className="flex items-end gap-2 rounded-4xl bg-card p-2 shadow-soft">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, LIMITS.questionMaxLength))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submit(e);
          }}
          rows={2}
          placeholder="Ask a question…"
          aria-label="Your question"
          className="min-w-0 flex-1 resize-none bg-transparent px-3 py-2 text-lg outline-none placeholder:text-muted"
        />
        <button className="pill h-12 w-12 flex-none p-0" disabled={sending || text.trim().length < 2} aria-label="Send question">
          <ArrowUp size={22} strokeWidth={2.5} aria-hidden />
        </button>
      </form>
      {text.length > LIMITS.questionMaxLength - 40 && (
        <p className="-mt-3 text-right text-xs text-muted">
          {text.length}/{LIMITS.questionMaxLength}
        </p>
      )}

      <h2 className="poster text-4xl">Top Questions</h2>

      {open.length === 0 && rest.length === 0 && (
        <p className="py-6 text-center font-light text-text2">No questions yet. Be the first. Nobody will know it was you.</p>
      )}

      {top.length > 0 && (
        <ol className="grid grid-cols-3 items-end gap-2" aria-label="Top three">
          {[1, 0, 2].map((rank) => {
            const q = top[rank];
            if (!q) return <li key={rank} />;
            return (
              <li key={`${rank}-${q.id}`} className="flex flex-col items-center gap-1 text-center">
                <span className="line-clamp-3 text-sm font-medium leading-tight">{q.text}</span>
                <button
                  onClick={() => onUpvote(q.id)}
                  aria-pressed={upvoted.has(q.id)}
                  aria-label={`Upvote, ${q.votes} votes`}
                  className={`flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${upvoted.has(q.id) ? "bg-ink text-on-ink" : "bg-card shadow-soft"}`}
                >
                  <ChevronUp size={14} strokeWidth={2.75} aria-hidden /> {q.votes}
                </button>
                <span
                  className={`flex w-full origin-bottom animate-grow-y items-start justify-center rounded-t-3xl pt-2 text-3xl font-semibold text-[#121212] ${PODIUM[rank]!.bg}`}
                  style={{ height: PODIUM[rank]!.h }}
                >
                  {rank + 1}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {rest.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rest.map((q) => (
            <li key={q.id} className={`flex items-center gap-3 rounded-3xl bg-card p-3 shadow-soft ${q.status === "answered" ? "opacity-60" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="leading-snug">{q.text}</p>
                <p className="text-xs text-muted">
                  {mine.has(q.id) ? "Your question" : ""}
                  {mine.has(q.id) && q.status === "answered" ? " · " : ""}
                  {q.status === "answered" ? (
                    <span className="font-semibold text-forest">
                      <Ico icon={Check} size={13} /> Answered
                    </span>
                  ) : (
                    ""
                  )}
                </p>
              </div>
              <button
                onClick={() => onUpvote(q.id)}
                aria-pressed={upvoted.has(q.id)}
                aria-label={`Upvote, ${q.votes} votes`}
                className={`flex h-12 w-12 flex-none flex-col items-center justify-center rounded-2xl text-sm font-semibold ${
                  upvoted.has(q.id) ? "bg-ink text-on-ink" : "bg-paper"
                }`}
              >
                <ChevronUp size={18} strokeWidth={2.75} aria-hidden />
                <span className="-mt-0.5">{q.votes}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {top.some((q) => mine.has(q.id)) && <p className="text-center text-sm text-muted">
          <Ico icon={Trophy} size={15} className="mr-1 text-coral" />
          Your question is on the podium.
        </p>}
    </div>
  );
}
