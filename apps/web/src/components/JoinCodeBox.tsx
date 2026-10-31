"use client";

import { JOIN_CODE_LENGTH, normalizeJoinCode } from "@handsup/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** The "Have a class code?" box used on the homepage and the student pages. */
export function JoinCodeBox({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const ready = code.length === JOIN_CODE_LENGTH;

  return (
    <form
      className="flex w-full max-w-md items-center gap-2 rounded-full bg-card p-1.5 shadow-soft"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) router.push(`/j/${code}`);
        else router.push(`/join${code ? `?code=${code}` : ""}`);
      }}
    >
      <input
        aria-label="Class code"
        value={code}
        onChange={(e) => setCode(normalizeJoinCode(e.target.value))}
        placeholder={compact ? "Class code" : "Have a class code? e.g. K7Q2MX"}
        className="min-w-0 flex-1 bg-transparent px-4 py-2 text-lg tracking-[0.2em] uppercase outline-none placeholder:tracking-normal placeholder:normal-case placeholder:text-muted"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
      />
      <button className="pill" type="submit">
        Join →
      </button>
    </form>
  );
}
