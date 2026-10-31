"use client";

import { Camera } from "lucide-react";
import { JOIN_CODE_LENGTH, normalizeJoinCode } from "@handsup/shared";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

const MESSAGES: Record<string, string> = {
  not_found: "We couldn't find that class. Check the code on the slide and try again.",
  ended: "That class has already ended.",
  too_many_attempts: "Tried a lot of codes? Wait a minute before trying again.",
  network: "Couldn't reach HandsUp. Check your connection and try again.",
};

export function JoinForm({ initialCode, initialError }: { initialCode: string; initialError: string | null }) {
  const router = useRouter();
  const [code, setCode] = useState(normalizeJoinCode(initialCode));
  const [error, setError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ready = code.length === JOIN_CODE_LENGTH;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/join/${code}`, { cache: "no-store" });
      if (res.ok) {
        const info = await res.json();
        if (info.status === "ended") setError("ended");
        else router.push(`/j/${code}`);
      } else {
        setError((await res.json().catch(() => ({}))).error ?? "not_found");
      }
    } catch {
      setError("network");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" tabIndex={-1} className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-5 py-6">
      <div className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">No account needed</span>
          <ThemeToggle />
        </div>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-6">
        <h1 className="poster text-6xl">
          Enter your
          <br />
          class code
        </h1>
        <p className="font-light text-text2">It&apos;s the 6 characters on your teacher&apos;s slide.</p>

        <label className="relative block" onClick={() => inputRef.current?.focus()}>
          <span className="sr-only">Class code</span>
          <div className="flex justify-between gap-2" aria-hidden>
            {Array.from({ length: JOIN_CODE_LENGTH }).map((_, i) => (
              <span
                key={i}
                className={`flex h-16 flex-1 items-center justify-center rounded-2xl border-2 bg-card text-3xl font-semibold ${
                  error === "not_found" ? "border-coral" : i === code.length ? "border-ink" : "border-line"
                }`}
              >
                {code[i] ?? ""}
              </span>
            ))}
          </div>
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => {
              setCode(normalizeJoinCode(e.target.value));
              setError(null);
            }}
            className="absolute inset-0 h-full w-full cursor-text opacity-0"
            autoFocus
            autoCapitalize="characters"
            autoComplete="one-time-code"
            spellCheck={false}
            maxLength={JOIN_CODE_LENGTH}
            aria-invalid={Boolean(error)}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-2xl bg-coral/15 px-4 py-3 text-coral">
            {MESSAGES[error] ?? MESSAGES.not_found}
            {error === "not_found" && <span className="block text-sm opacity-80">Codes are 6 characters, like K7Q2MX.</span>}
          </p>
        )}

        <button className="pill py-4 text-lg" disabled={!ready || busy}>
          {busy ? "Checking…" : "Join class →"}
        </button>
        <p className="text-center text-sm text-muted"><Camera size={15} strokeWidth={2.25} className="mr-1 inline-block align-[-0.15em]" aria-hidden />
        Got a QR code? Just scan it with your camera app.</p>
      </form>
    </main>
  );
}
