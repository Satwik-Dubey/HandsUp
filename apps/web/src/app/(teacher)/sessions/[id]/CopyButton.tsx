"use client";

import { Check } from "lucide-react";
import { useState } from "react";

export function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="pill-ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
    >
      {done ? (
        <>
          <Check size={16} strokeWidth={2.75} aria-hidden /> Copied
        </>
      ) : (
        label
      )}
    </button>
  );
}
