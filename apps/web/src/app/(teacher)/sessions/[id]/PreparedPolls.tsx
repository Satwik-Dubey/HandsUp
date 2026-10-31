"use client";

import { POLL_KIND_META, type PollKind } from "@handsup/shared";
import { Copy } from "lucide-react";
import { useState, useTransition } from "react";
import { PollForm } from "@/components/polls/PollForm";
import { deletePoll, type ManageResult } from "../../actions";

export interface PreparedPoll {
  id: string;
  question: string;
  kind: PollKind;
  options: string[];
  ran: boolean;
}

export function PreparedPolls({
  sessionId,
  polls,
  editable,
  sources = [],
  copy,
}: {
  sessionId: string;
  polls: PreparedPoll[];
  editable: boolean;
  /** Earlier lectures of this course that have polls. */
  sources?: { id: string; title: string; n: number }[];
  copy?: (fromSessionId: string) => Promise<ManageResult & { copied?: number }>;
}) {
  const [pending, start] = useTransition();
  const [from, setFrom] = useState(sources[0]?.id ?? "");
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="card flex flex-col gap-4 p-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-semibold">Prepared polls</h2>
        <span className="text-sm text-muted">{polls.length} ready</span>
      </div>
      {polls.length > 0 && (
        <ol className="flex flex-col gap-2">
          {polls.map((p, i) => (
            <li key={p.id} className="flex items-start gap-3 rounded-2xl bg-paper p-3">
              <span className="badge h-8 w-8 bg-ink text-sm text-on-ink">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.question}</p>
                <p className="text-sm text-muted">
                  {POLL_KIND_META[p.kind].label}
                  {p.kind !== "rating" && ` · ${p.options.join(" / ")}`}
                  {p.ran && " · already ran"}
                </p>
              </div>
              {editable && !p.ran && (
                <button
                  className="text-sm text-muted hover:text-coral"
                  disabled={pending}
                  onClick={() => start(() => deletePoll(sessionId, p.id))}
                  aria-label={`Delete poll ${i + 1}`}
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      {editable && copy && sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-line p-3">
          <span className="text-sm text-muted">Reuse polls from</span>
          <select className="field w-auto min-w-0 flex-1 py-2" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Lecture to copy polls from">
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.n} {s.n === 1 ? "poll" : "polls"})
              </option>
            ))}
          </select>
          <button
            className="pill-ghost pill-sm"
            disabled={pending || !from}
            onClick={() =>
              start(async () => {
                const r = await copy(from);
                setNote(r.ok ? `Copied ${r.copied} ${r.copied === 1 ? "poll" : "polls"}.` : r.error);
              })
            }
          >
            <Copy size={15} strokeWidth={2.25} aria-hidden /> Copy
          </button>
          {note && <p className="w-full text-sm text-muted">{note}</p>}
        </div>
      )}
      {editable && <PollForm sessionId={sessionId} />}
      <p className="text-sm text-muted">Launch them with one tap from the live dashboard. You can also make a quick poll there during class.</p>
    </div>
  );
}
