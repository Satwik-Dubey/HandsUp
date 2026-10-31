"use client";

import { Sparkles } from "lucide-react";
import { IconBadge } from "@/components/icons";
import { formatOffset, type InsightView } from "@handsup/shared";
import { useEffect, useState } from "react";

const STYLE: Record<InsightView["severity"], string> = {
  alert: "bg-coral text-white",
  warn: "bg-sun text-[#121212]",
  info: "bg-paper",
};
const LABEL: Record<string, string> = {
  engagement_drop: "Engagement",
  confusion_spike: "Confusion",
  hot_question: "Hot question",
  pace: "Pace",
  understanding_drop: "Understanding",
};

function ago(t: number, now: number) {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} h ago`;
}

/**
 * "AI Insights": rule-based alerts (instant) and Groq-written suggestions (once a minute).
 * The newest card is big and colored; dismissed ones fold into "Earlier".
 */
export function InsightsPanel({
  insights,
  startedAt,
  onDismiss,
  onPoll,
  onShowQuestion,
  compact = false,
}: {
  insights: InsightView[];
  startedAt: number | null;
  onDismiss: (id: string) => void;
  onPoll: () => void;
  onShowQuestion: (clusterId: string | null) => void;
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [showEarlier, setShowEarlier] = useState(false);
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(iv);
  }, []);

  const open = insights.filter((i) => !i.acknowledged);
  const earlier = insights.filter((i) => i.acknowledged);
  const shown = compact ? open.slice(0, 1) : open.slice(0, 4);

  return (
    <section className="card flex flex-col gap-3 p-6" aria-live="polite">
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-2.5 text-xl font-semibold">
          <IconBadge icon={Sparkles} tone="coral" size="sm" /> AI insights
        </h2>
        {open[0] && <span className="text-sm text-muted">{ago(open[0].at, now)}</span>}
      </div>

      {shown.length === 0 && (
        <p className="py-4 text-center font-light text-text2">
          All calm. Alerts appear here when confusion spikes, the pace is off, or many students ask the same thing.
        </p>
      )}

      {shown.map((i, n) => (
        // keyed by id: a new alert mounts, slides in, and (if it's the top, non-info one) pulses twice
        <article
          key={i.id}
          className={`relative flex animate-slide-in flex-col gap-2 rounded-2xl p-4 transition-colors duration-500 ${n === 0 ? STYLE[i.severity] : "bg-paper"}`}
        >
          {n === 0 && i.severity !== "info" && <span className="pointer-events-none absolute inset-0 animate-ring rounded-2xl" aria-hidden />}
          <p className={`text-xs font-semibold uppercase tracking-wide ${n === 0 && i.severity !== "info" ? "opacity-80" : "text-muted"}`}>
            {startedAt ? `${formatOffset(i.at - startedAt)} · ` : ""}
            {i.kind === "suggestion" ? "Insight" : i.rule ? LABEL[i.rule] : "Alert"}
            {i.segmentLabel ? ` · ${i.segmentLabel}` : ""}
          </p>
          <p className={n === 0 ? "text-lg font-medium leading-snug" : ""}>{i.message}</p>
          <div className="flex flex-wrap items-center gap-2">
            {i.action && i.actionKind === "poll" && (
              <button className={n === 0 && i.severity !== "info" ? "pill pill-sm" : "pill-coral pill-sm"} onClick={onPoll}>
                {i.action}
              </button>
            )}
            {i.action && i.actionKind === "question" && (
              <button className={n === 0 && i.severity !== "info" ? "pill pill-sm" : "pill-coral pill-sm"} onClick={() => onShowQuestion(i.clusterId)}>
                Show questions
              </button>
            )}
            {i.action && !i.actionKind && <span className="text-sm font-semibold">→ {i.action}</span>}
            <button className="ml-auto text-sm underline-offset-2 hover:underline" onClick={() => onDismiss(i.id)}>
              Dismiss
            </button>
          </div>
        </article>
      ))}

      {!compact && earlier.length > 0 && (
        <div>
          <button className="text-sm text-muted" onClick={() => setShowEarlier((v) => !v)}>
            {showEarlier ? "Hide" : "Show"} earlier ({earlier.length})
          </button>
          {showEarlier && (
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {earlier.map((i) => (
                <li key={i.id} className="flex gap-2">
                  <span className="w-12 flex-none tabular-nums text-muted">{startedAt ? formatOffset(i.at - startedAt) : ""}</span>
                  <span className="text-text2">{i.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
