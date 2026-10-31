"use client";

import { BarChart3, Check } from "lucide-react";
import { IconBadge } from "@/components/icons";
import type { PollChoice, PollResults, PollView } from "@handsup/shared";
import { useEffect, useState } from "react";

export function PollTab({
  poll,
  myChoice,
  results,
  showResults,
  onVote,
}: {
  poll: PollView | null;
  myChoice: PollChoice | null;
  results: PollResults | null;
  showResults: boolean;
  onVote: (c: PollChoice) => void;
}) {
  const [multi, setMulti] = useState<number[]>([]);
  useEffect(() => setMulti(Array.isArray(myChoice) ? myChoice : []), [poll?.id, myChoice]);

  if (!poll) {
    return (
      <div className="flex flex-col items-center gap-3 py-14 text-center">
        <IconBadge icon={BarChart3} tone="sky" size="xl" />
        <p className="text-xl font-semibold">No poll right now</p>
        <p className="max-w-xs font-light text-text2">When your teacher launches one, it appears here by itself.</p>
      </div>
    );
  }

  const closed = Boolean(poll.closedAt);
  const voted = myChoice !== null;
  const r = results && results.pollId === poll.id ? results : null;
  const reveal = showResults && r && (voted || closed);
  const total = Math.max(1, r?.voters ?? 0);
  const chosen = (i: number) =>
    poll.kind === "rating" ? myChoice === i + 1 : poll.kind === "multi" ? (Array.isArray(myChoice) ? myChoice.includes(i) : false) : myChoice === i;

  return (
    <div key={poll.id} className="flex animate-slide-up flex-col gap-4">
      <div className="relative overflow-hidden rounded-4xl bg-forest p-6 text-white">
        <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">{closed ? "Poll closed" : "● Live poll"}</span>
        <h1 className="poster mt-4 text-4xl leading-none">{poll.question}</h1>
        {poll.kind === "multi" && !closed && <p className="mt-2 font-light text-white/90">Tick all that apply.</p>}
      </div>

      {poll.kind === "rating" ? (
        <div className="flex gap-2" role="radiogroup" aria-label={poll.question}>
          {poll.options.map((o, i) => (
            <button
              key={o}
              role="radio"
              aria-checked={chosen(i)}
              disabled={closed}
              onClick={() => onVote(i + 1)}
              className={`flex-1 rounded-2xl py-5 text-2xl font-semibold transition disabled:opacity-60 ${chosen(i) ? "bg-ink text-on-ink" : "bg-card shadow-soft"}`}
            >
              {o}
              {reveal && <span className="block text-xs font-normal opacity-80">{Math.round(((r!.counts[i] ?? 0) / total) * 100)}%</span>}
            </button>
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {poll.options.map((o, i) => {
            const selected = poll.kind === "multi" && !closed ? multi.includes(i) : chosen(i);
            const pct = r ? Math.round(((r.counts[i] ?? 0) / total) * 100) : 0;
            return (
              <li key={i}>
                <button
                  disabled={closed}
                  onClick={() => (poll.kind === "multi" ? setMulti((m) => (m.includes(i) ? m.filter((x) => x !== i) : [...m, i])) : onVote(i))}
                  className={`relative flex w-full items-center justify-between overflow-hidden rounded-3xl px-5 py-4 text-left text-lg font-medium shadow-soft transition disabled:cursor-default ${
                    selected ? "bg-ink text-on-ink" : "bg-card"
                  }`}
                >
                  {reveal && (
                    <span
                      className={`absolute inset-y-0 left-0 origin-left animate-grow-x transition-[width] duration-700 ${selected ? "bg-white/15" : "bg-lime/40"}`}
                      style={{ width: `${pct}%` }}
                    />
                  )}
                  <span className="relative">{o}</span>
                  <span className="relative font-semibold">{reveal ? `${pct}%` : selected ? <Check size={20} strokeWidth={2.5} aria-label="Selected" /> : ""}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {poll.kind === "multi" && !closed && (
        <button className="pill py-3.5" disabled={!multi.length} onClick={() => onVote(multi)}>
          {voted ? "Update my answer" : "Submit"}
        </button>
      )}
      <p className="text-center text-sm text-muted">
        {closed ? (voted ? "Thanks for voting." : "This poll has closed.") : voted ? "Vote saved. You can change it until the poll closes." : "Your vote is anonymous."}
        {reveal && ` · ${r!.voters} voted`}
      </p>
    </div>
  );
}
