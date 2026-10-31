"use client";

import { useEffect, useState } from "react";

const COLORS = ["#E0573F", "#F2C94C", "#9CCADF", "#8CC56C", "#9A7CEB", "#F3A9B7"];

/** A one-off shower of paper strips across the screen, for moments worth celebrating. */
export function ConfettiBurst({ pieces = 36 }: { pieces?: number }) {
  const [strips, setStrips] = useState<{ left: number; delay: number; w: number; color: string; rot: number }[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setStrips(
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        w: 6 + Math.random() * 6,
        color: COLORS[i % COLORS.length]!,
        rot: Math.random() * 180,
      })),
    );
    const t = setTimeout(() => setStrips([]), 4000);
    return () => clearTimeout(t);
  }, [pieces]);

  if (!strips.length) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {strips.map((s, i) => (
        <span
          key={i}
          className="absolute top-0 block animate-fall rounded-sm"
          style={{ left: `${s.left}%`, width: s.w, height: s.w * 2.4, background: s.color, animationDelay: `${s.delay}s`, rotate: `${s.rot}deg` }}
        />
      ))}
    </div>
  );
}
