"use client";

import { useEffect, useRef, useState } from "react";

/** Eases a number from its previous value to the new one (about half a second) instead of jumping. */
export function CountUp({ value, format = (n) => String(Math.round(n)) }: { value: number | null; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (value === null || from.current === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = from.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 550);
      const eased = 1 - (1 - k) ** 3;
      const n = start + (value - start) * eased;
      from.current = n;
      setShown(n);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{shown === null ? "–" : format(shown)}</>;
}
