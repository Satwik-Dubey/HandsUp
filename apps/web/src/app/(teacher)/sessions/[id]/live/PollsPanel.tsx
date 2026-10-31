"use client";

import { BarChart3, Plus } from "lucide-react";
import { IconBadge } from "@/components/icons";
import { POLL_KIND_META, type PollKind, type PollResults, type PollView } from "@handsup/shared";
import { PollForm } from "@/components/polls/PollForm";

export interface DashboardPoll {
  id: string;
  question: string;
  kind: PollKind;
  options: string[];
  openedAt: number | null;
  closedAt: number | null;
  results: PollResults;
}

export function PollsPanel({
  sessionId,
  polls,
  active,
  results,
  live,
  onLaunch,
  onClose,
  onCreated,
  adding,
  setAdding,
}: {
  sessionId: string;
  polls: DashboardPoll[];
  active: PollView | null;
  results: Record<string, PollResults>;
  live: boolean;
  onLaunch: (id: string) => void;
  onClose: (id: string) => void;
  onCreated: (id: string) => void;
  /** Lifted so an insight's "Run a quick poll" can open the form. */
  adding: boolean;
  setAdding: (v: boolean | ((v: boolean) => boolean)) => void;
}) {
  return (
    <section className="card flex flex-col gap-4 p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-2.5 text-xl font-semibold">
          <IconBadge icon={BarChart3} tone="sky" size="sm" /> Polls
        </h2>
        <button className="flex items-center gap-1 text-sm font-semibold" onClick={() => setAdding((a) => !a)}>
          {adding ? (
            "Cancel"
          ) : (
            <>
              <Plus size={18} strokeWidth={2.5} aria-hidden /> Quick poll
            </>
          )}
        </button>
      </div>

      {adding && (
        <div className="rounded-2xl bg-paper p-4">
          <PollForm
            sessionId={sessionId}
            submitLabel={live ? "Create and launch" : "Create"}
            onCreated={(id) => {
              setAdding(false);
              onCreated(id);
            }}
          />
        </div>
      )}

      {polls.length === 0 && !adding && <p className="py-4 text-center text-muted">No polls yet. Prepare them on the lecture page, or make a quick one here.</p>}

      <ul className="flex flex-col gap-3">
        {polls.map((p, i) => {
          const isActive = active?.id === p.id;
          const r = results[p.id] ?? p.results;
          const ran = Boolean(p.openedAt) || isActive;
          return (
            <li key={p.id} className={`flex flex-col gap-3 rounded-2xl p-4 ${isActive ? "bg-coral/10 ring-2 ring-coral" : "bg-paper"}`}>
              <div className="flex items-start gap-3">
                <span className="badge h-8 w-8 bg-ink text-sm text-on-ink">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.question}</p>
                  <p className="text-xs text-muted">
                    {POLL_KIND_META[p.kind].label}
                    {isActive ? " · ● open now" : ran ? " · closed" : ""}
                    {ran ? ` · ${r.voters} voted` : ""}
                  </p>
                </div>
                {isActive ? (
                  <button className="pill pill-sm" onClick={() => onClose(p.id)}>
                    Close
                  </button>
                ) : (
                  <button className="pill-coral pill-sm" disabled={!live} title={live ? "" : "Go live first"} onClick={() => onLaunch(p.id)}>
                    {ran ? "Relaunch" : "Launch"}
                  </button>
                )}
              </div>
              {ran && <ResultBars options={p.options} results={r} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ResultBars({ options, results }: { options: string[]; results: PollResults }) {
  const total = Math.max(1, results.voters);
  const max = Math.max(...results.counts);
  return (
    <ul className="flex flex-col gap-1.5">
      {options.map((o, i) => {
        const n = results.counts[i] ?? 0;
        const pct = Math.round((n / total) * 100);
        return (
          <li key={i} className="relative overflow-hidden rounded-xl bg-card px-3 py-2 text-sm">
            <span className={`absolute inset-y-0 left-0 transition-all duration-500 ${n === max && n > 0 ? "bg-lime/60" : "bg-line"}`} style={{ width: `${pct}%` }} />
            <span className="relative flex justify-between gap-3">
              <span className="truncate">{o}</span>
              <span className="font-semibold tabular-nums">
                {pct}% <span className="font-normal text-muted">({n})</span>
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
