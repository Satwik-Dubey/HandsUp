"use client";

import { Users } from "lucide-react";
import { useEffect, useState } from "react";
import { QrCode } from "./QrCode";

/** "Present full screen": a giant QR and code for the projector. Esc or click closes it. */
export function PresentQr({
  joinUrl,
  code,
  title,
  active,
  label = "Present full screen",
  className = "pill-ghost",
  openSignal = 0,
}: {
  joinUrl: string;
  code: string;
  title: string;
  active?: number;
  label?: string;
  className?: string;
  /** Bump this number to open the QR from outside (the dashboard's Q shortcut). */
  openSignal?: number;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (openSignal) setOpen(true);
  }, [openSignal]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      window.removeEventListener("keydown", onKey);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [open]);

  const shortUrl = joinUrl.replace(/^https?:\/\//, "");

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-8 bg-paper p-8"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-label="Join code, full screen"
        >
          <p className="text-2xl text-muted">{title}</p>
          <div className="flex flex-col items-center gap-10 lg:flex-row">
            <QrCode value={joinUrl} size={Math.min(480, typeof window !== "undefined" ? window.innerHeight * 0.55 : 400)} />
            <div className="flex flex-col items-center gap-4 lg:items-start">
              <p className="poster text-6xl">Scan to join</p>
              <p className="text-2xl text-text2">or go to</p>
              <p className="text-3xl font-semibold">{shortUrl.replace(/\/j\/.*$/, "/join")}</p>
              <p className="poster text-8xl tracking-[0.15em] lg:text-9xl">{code}</p>
              {active !== undefined && (
                <p className="flex items-center gap-2 text-2xl">
                  <Users size={26} strokeWidth={2.25} aria-hidden /> {active} here
                </p>
              )}
            </div>
          </div>
          <p className="text-muted">No account needed · anonymous · click anywhere to close</p>
        </div>
      )}
    </>
  );
}
