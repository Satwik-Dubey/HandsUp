"use client";

import { Moon, Sun, SunMoon, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";
const NEXT: Record<Mode, Mode> = { system: "light", light: "dark", dark: "system" };
const ICON: Record<Mode, LucideIcon> = { system: SunMoon, light: Sun, dark: Moon };

/** Cycles system → light → dark. The choice is remembered on this device. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    try {
      const t = localStorage.getItem("handsup:theme");
      if (t === "light" || t === "dark") setMode(t);
    } catch {}
  }, []);

  function cycle() {
    const next = NEXT[mode];
    setMode(next);
    const root = document.documentElement;
    if (next === "system") delete root.dataset.theme;
    else root.dataset.theme = next;
    try {
      if (next === "system") localStorage.removeItem("handsup:theme");
      else localStorage.setItem("handsup:theme", next);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className={`flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft ${className}`}
      aria-label={`Theme: ${mode}. Switch to ${NEXT[mode]}`}
      title={`Theme: ${mode}`}
    >
      {(() => {
        const Icon = ICON[mode];
        return <Icon aria-hidden size={19} strokeWidth={2.25} />;
      })()}
    </button>
  );
}
