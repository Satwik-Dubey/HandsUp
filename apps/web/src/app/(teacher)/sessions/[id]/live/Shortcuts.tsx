"use client";

import { Keyboard, X } from "lucide-react";
import { useEffect } from "react";

export const SHORTCUTS = [
  ["N", "Next slide (marks the timeline)"],
  ["P", "Quick poll"],
  ["Q", "Show the QR code full screen"],
  ["?", "Show or hide this list"],
  ["Esc", "Close"],
] as const;

/** Single-key shortcuts for the live dashboard. Ignored while typing in a field or holding a modifier key. */
export function useShortcuts(handlers: Partial<Record<"n" | "p" | "q" | "?" | "escape", () => void>>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      const key = e.key === "?" ? "?" : e.key.toLowerCase();
      const fn = handlers[key as keyof typeof handlers];
      if (!fn) return;
      e.preventDefault();
      fn();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);
}

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" className="card flex w-full max-w-sm animate-slide-up flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h2 id="shortcuts-title" className="flex items-center gap-2 text-2xl font-semibold">
            <Keyboard size={22} strokeWidth={2.25} aria-hidden /> Shortcuts
          </h2>
          <button className="rounded-full p-1.5 hover:bg-paper" onClick={onClose} aria-label="Close">
            <X size={20} strokeWidth={2.25} />
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {SHORTCUTS.map(([k, what]) => (
            <li key={k} className="flex items-center gap-3">
              <kbd className="min-w-10 rounded-xl bg-paper px-2.5 py-1 text-center font-semibold shadow-soft">{k}</kbd>
              <span>{what}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
