import { BarChart3, CircleHelp, Flame, Trophy, Users } from "lucide-react";
import { IconBadge, REACTION_ICON } from "./icons";
import { Wordmark } from "./Logo";
import { REACTIONS, REACTION_META } from "@handsup/shared";
import { Confetti } from "./Confetti";

/** Illustrations of the product for the public pages (static, no data). */
export function PhoneMock({ className = "" }: { className?: string }) {
  return (
    <div className={`mx-auto w-[260px] animate-float rounded-[44px] bg-ink p-3 shadow-float ${className}`} aria-hidden>
      <div className="flex flex-col gap-3 rounded-[34px] bg-paper p-4">
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="font-semibold text-ink">
            <Wordmark size={16} />
          </span>
          <span className="flex items-center gap-1">
            <Users size={12} strokeWidth={2.5} /> 212
          </span>
        </div>
        <p className="poster text-3xl">Lecture 9 · Paging</p>
        <div className="grid grid-cols-2 gap-2">
          {REACTIONS.filter((r) => r !== "confused").map((r) => (
            <div key={r} className="flex flex-col items-center rounded-2xl bg-card py-3 shadow-soft">
              <IconBadge icon={REACTION_ICON[r].icon} tone={REACTION_ICON[r].tone} size="sm" />
              <span className="text-xs">{REACTION_META[r].short}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-sun py-4 text-center text-lg font-semibold text-[#121212]">
          <CircleHelp size={20} strokeWidth={2.5} /> I&apos;M CONFUSED
        </div>
        <div className="flex justify-around rounded-full bg-ink px-2 py-2 text-xs text-on-ink">
          <span className="flex items-center gap-1">
            <Flame size={12} strokeWidth={2.5} /> React
          </span>
          <span className="flex items-center gap-1 opacity-60">
            <BarChart3 size={12} strokeWidth={2.5} /> Poll
          </span>
          <span className="flex items-center gap-1 opacity-60">
            <Trophy size={12} strokeWidth={2.5} /> Questions
          </span>
        </div>
      </div>
    </div>
  );
}

export function DashboardMock() {
  return (
    <div className="card flex flex-col gap-4 p-5" aria-hidden>
      <div className="flex items-center gap-2">
        <span className="font-semibold">Lecture 9 · Paging</span>
        <span className="ml-auto rounded-full bg-coral px-3 py-1 text-xs font-semibold text-white">● LIVE 34:12</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          ["bg-sky", "Students", "212"],
          ["bg-violet", "Understanding", "64"],
          ["bg-coral", "Confused", "14%"],
        ].map(([c, l, v]) => (
          <div key={l} className="rounded-2xl bg-paper p-3">
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <i className={`h-2.5 w-2.5 rounded-full ${c}`} /> {l}
            </span>
            <span className="poster text-4xl">{v}</span>
          </div>
        ))}
      </div>
      <svg viewBox="0 0 300 70" className="w-full">
        <rect x="186" y="0" width="26" height="70" fill="#F2C94C" opacity=".3" />
        <path d="M0 30 L40 26 L80 20 L120 18 L160 28 L200 52 L230 46 L260 30 L300 22" fill="none" stroke="#E0573F" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      <div className="relative overflow-hidden rounded-2xl bg-coral p-4 text-white">
        <Confetti />
        <p className="relative text-xs font-semibold uppercase opacity-80">34:02 · Alert</p>
        <p className="relative font-medium">30 confused on slide 12 · 42 asking “TLB vs page table?”</p>
      </div>
    </div>
  );
}
