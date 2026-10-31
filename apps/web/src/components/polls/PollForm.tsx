"use client";

import { Plus, X } from "lucide-react";
import { LIMITS, POLL_KINDS, POLL_KIND_META, type PollKind } from "@handsup/shared";
import { useActionState, useEffect, useRef, useState } from "react";
import { createPoll } from "@/app/(teacher)/actions";

/** Add a poll: used on the lecture page (prepare before class) and on the dashboard (quick poll). */
export function PollForm({ sessionId, onCreated, submitLabel = "Add poll" }: { sessionId: string; onCreated?: (pollId: string) => void; submitLabel?: string }) {
  const [state, action, pending] = useActionState(createPoll, undefined);
  const [kind, setKind] = useState<PollKind>("single");
  const [options, setOptions] = useState(["", ""]);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state && state.ok && state.pollId) {
      formRef.current?.reset();
      setOptions(["", ""]);
      setKind("single");
      onCreated?.(state.pollId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input name="question" className="field" placeholder="Which policy evicts the page unused longest?" required minLength={2} maxLength={200} />
      <div className="flex flex-wrap gap-2">
        {POLL_KINDS.map((k) => (
          <label key={k} className="cursor-pointer">
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="peer sr-only" />
            <span className="block rounded-full bg-paper px-3 py-1.5 text-sm peer-checked:bg-ink peer-checked:text-on-ink" title={POLL_KIND_META[k].hint}>
              {POLL_KIND_META[k].label}
            </span>
          </label>
        ))}
      </div>
      {kind === "rating" ? (
        <p className="text-sm text-muted">Students pick 1 to 5.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {options.map((o, i) => (
            <div key={i} className="flex gap-2">
              <input
                name="option"
                className="field py-2"
                placeholder={`Option ${i + 1}`}
                value={o}
                maxLength={LIMITS.pollOptionMaxLength}
                onChange={(e) => setOptions((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
              />
              {options.length > 2 && (
                <button type="button" aria-label="Remove option" className="px-2 text-muted" onClick={() => setOptions((p) => p.filter((_, j) => j !== i))}>
                  <X size={18} strokeWidth={2.25} />
                </button>
              )}
            </div>
          ))}
          {options.length < LIMITS.pollMaxOptions && (
            <button type="button" className="flex items-center gap-1 self-start text-sm font-semibold" onClick={() => setOptions((p) => [...p, ""])}>
              <Plus size={18} strokeWidth={2.5} aria-hidden /> Add option
            </button>
          )}
        </div>
      )}
      {state?.error && <p className="text-sm text-coral">{state.error}</p>}
      <button className="pill self-start" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
