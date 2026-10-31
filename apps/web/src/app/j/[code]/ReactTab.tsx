"use client";

import { LIMITS, REACTION_META, type Reaction, type SessionInputs } from "@handsup/shared";
import { useEffect, useRef, useState } from "react";
import { IconBadge, REACTION_ICON } from "@/components/icons";

const TILES: Reaction[] = ["gotIt", "tooFast", "tooSlow", "example"];

/** Reaction buttons, the big confused button and the 1–5 clarity rating. Taps are batched for 500 ms. */
export function ReactTab({
  inputs,
  rating,
  onReactions,
  onRate,
  onTap,
}: {
  inputs: SessionInputs;
  rating: number | null;
  onReactions: (counts: Partial<Record<Reaction, number>>) => void;
  onRate: (v: number) => void;
  onTap: () => void;
}) {
  const [bursts, setBursts] = useState<{ id: number; kind: Reaction }[]>([]);
  const pending = useRef<Partial<Record<Reaction, number>>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstId = useRef(0);
  const sendRef = useRef(onReactions);
  sendRef.current = onReactions;

  function flush() {
    timer.current = null;
    const counts = pending.current;
    pending.current = {};
    if (Object.keys(counts).length) sendRef.current(counts);
  }

  // Don't lose taps when switching tabs mid-batch.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        flush();
      }
    },
    [],
  );

  function tap(kind: Reaction) {
    const cur = pending.current[kind] ?? 0;
    if (cur < LIMITS.maxTapsPerMessage) pending.current[kind] = cur + 1;
    if (!timer.current) timer.current = setTimeout(flush, LIMITS.reactBatchMs);
    const id = ++burstId.current;
    setBursts((b) => [...b.slice(-8), { id, kind }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 700);
    onTap();
    navigator.vibrate?.(8);
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold leading-tight">How&apos;s it going?</h1>
        <p className="font-light text-text2">Tap as often as you like.</p>
      </div>

      {inputs.react && (
        <div className="grid grid-cols-2 gap-3">
          {TILES.map((k) => (
            <button
              key={k}
              onClick={() => tap(k)}
              className="relative flex h-28 flex-col items-center justify-center gap-1.5 rounded-4xl bg-card shadow-soft transition active:scale-[0.95]"
            >
              {/* keyed by the last burst so the badge pops on every tap */}
              <IconBadge
                key={bursts.filter((b) => b.kind === k).at(-1)?.id ?? 0}
                icon={REACTION_ICON[k].icon}
                tone={REACTION_ICON[k].tone}
                size="lg"
                className="animate-boing"
              />
              <span className="font-medium">{REACTION_META[k].short}</span>
              {bursts
                .filter((b) => b.kind === k)
                .map((b) => (
                  <span key={b.id} className="pointer-events-none absolute right-4 top-3 animate-rise font-semibold">
                    +1
                  </span>
                ))}
            </button>
          ))}
        </div>
      )}

      {inputs.confused && (
        <button
          onClick={() => tap("confused")}
          className="relative rounded-4xl bg-sun py-6 text-2xl font-semibold tracking-wide text-[#121212] shadow-soft transition active:scale-[0.97]"
        >
          <span className="flex items-center justify-center gap-3">
            <IconBadge key={bursts.filter((b) => b.kind === "confused").at(-1)?.id ?? 0} icon={REACTION_ICON.confused.icon} tone="card" size="md" className="animate-boing" />
            I&apos;M CONFUSED
          </span>
          {bursts
            .filter((b) => b.kind === "confused")
            .map((b) => (
              <span key={b.id} className="pointer-events-none absolute right-8 top-2 animate-rise text-lg">
                +1
              </span>
            ))}
        </button>
      )}

      {inputs.rating && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">How clear is it so far?</p>
          <div className="flex gap-2" role="radiogroup" aria-label="Clarity from 1 to 5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                role="radio"
                aria-checked={rating === n}
                onClick={() => onRate(n)}
                className={`flex-1 rounded-2xl py-3 text-lg font-semibold transition ${rating === n ? "bg-ink text-on-ink" : "bg-card shadow-soft"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
