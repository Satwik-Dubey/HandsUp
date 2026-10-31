"use client";

import { Link2, PenLine } from "lucide-react";
import { IconBadge } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { eraseSessionData, regenerateReport, shareReport, unshareReport } from "../../../actions";

export function ReportActions({ sessionId, shareUrl }: { sessionId: string; shareUrl: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);

  const flash = (t: string) => {
    setNote(t);
    setTimeout(() => setNote((n) => (n === t ? null : n)), 2500);
  };

  const copyShare = () =>
    start(async () => {
      const token = await shareReport(sessionId);
      if (!token) return flash("The report isn't ready yet");
      const url = `${window.location.origin}/r/${token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      flash("Share link copied");
      router.refresh();
    });

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <button className="pill-ghost" onClick={copyShare} disabled={pending}>
        <Link2 size={17} strokeWidth={2.25} aria-hidden /> {shareUrl ? "Copy share link" : "Share link"}
      </button>
      <a className="pill-ghost" href={`/api/sessions/${sessionId}/report/pdf`}>
        Download PDF
      </a>
      <a className="pill-ghost" href={`/api/sessions/${sessionId}/export?type=timeline`}>
        Export CSV
      </a>
      <button className="pill-ghost px-3" aria-label="More" onClick={() => setMenu((m) => !m)}>
        ⋯
      </button>
      {menu && (
        <div className="absolute right-0 top-full z-20 mt-2 flex w-64 flex-col rounded-2xl bg-card p-2 shadow-float">
          <a className="rounded-xl px-3 py-2 hover:bg-paper" href={`/api/sessions/${sessionId}/export?type=questions`}>
            Export questions (CSV)
          </a>
          <a className="rounded-xl px-3 py-2 hover:bg-paper" href={`/api/sessions/${sessionId}/export?type=polls`}>
            Export poll results (CSV)
          </a>
          <button
            className="rounded-xl px-3 py-2 text-left hover:bg-paper"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setMenu(false);
                await regenerateReport(sessionId);
                router.refresh();
              })
            }
          >
            Rewrite the report
          </button>
          {shareUrl && (
            <button
              className="rounded-xl px-3 py-2 text-left hover:bg-paper"
              onClick={() =>
                start(async () => {
                  setMenu(false);
                  await unshareReport(sessionId);
                  flash("Share link turned off");
                })
              }
            >
              Turn off the share link
            </button>
          )}
          <button
            className="rounded-xl px-3 py-2 text-left text-coral hover:bg-paper"
            onClick={() => {
              if (!window.confirm("Erase all student data for this lecture now? Questions, taps and votes are deleted. The numbers in this report stay.")) return;
              start(async () => {
                setMenu(false);
                const r = await eraseSessionData(sessionId);
                flash(r.ok ? "Student data erased" : r.error);
                router.refresh();
              });
            }}
          >
            Erase student data now
          </button>
        </div>
      )}
      {note && (
        <div role="status" className="fixed inset-x-0 bottom-6 z-40 mx-auto w-fit rounded-full bg-ink px-5 py-2.5 text-on-ink shadow-float">
          {note}
        </div>
      )}
    </div>
  );
}

/** Shown for the few seconds the report worker needs after "End class"; refreshes until the report is there. */
export function ReportPending() {
  const router = useRouter();
  useEffect(() => {
    const iv = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(iv);
  }, [router]);
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <IconBadge icon={PenLine} tone="sun" size="xl" className="animate-pulse" />
      <p className="text-xl font-semibold">Writing your report…</p>
      <p className="max-w-md font-light text-text2">This usually takes under a minute. The page updates by itself. (Make sure the workers are running: `pnpm dev` starts them.)</p>
    </div>
  );
}
