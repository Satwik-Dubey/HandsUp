import { Reveal } from "@/components/motion/Reveal";
import { ChevronUp, Hand, HandHelping, Lock, Trophy } from "lucide-react";
import { Ico, IconBadge, REACTION_ICON } from "@/components/icons";
import Link from "next/link";
import { Confetti } from "@/components/Confetti";
import { JoinCodeBox } from "@/components/JoinCodeBox";
import { DashboardMock, PhoneMock } from "@/components/Mockups";
import { PublicFooter, PublicHeader } from "@/components/PublicHeader";

export default async function Home() {
  return (
    <>
      <PublicHeader />
      <main id="main" tabIndex={-1} className="flex flex-col gap-24 pb-20">
        {/* Hero */}
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pt-6 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pt-14">
          <section className="flex animate-fade-up flex-col gap-6">
            <span className="eyebrow">Free for classrooms</span>
            <h1 className="poster text-6xl sm:text-7xl lg:text-8xl">
              Know the moment
              <br />
              your class gets lost.
            </h1>
            <p className="max-w-xl text-lg font-light text-text2">
              Students tap “confused”, “too fast” or ask a question from their phone, anonymously. You see how well the room is following, live, and fix it
              before the lecture ends.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/login" className="pill-coral py-3.5 text-lg">
                Start a free class →
              </Link>
            </div>
            <JoinCodeBox />
            <p className="text-sm text-muted">Teachers sign in with Google. Students never need an account.</p>
          </section>

          <section aria-hidden className="relative animate-slide-up [animation-delay:150ms]">
            <div className="relative animate-float overflow-hidden rounded-4xl bg-coral p-6 pb-6 text-white shadow-float sm:pb-14">
              <Confetti />
              <div className="relative flex flex-col gap-4">
                <span className="self-start rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">● LIVE · Lecture 9</span>
                <p className="poster text-5xl">32 students are confused</p>
                <p className="font-light text-white/90">on slide 12 · Understanding 64</p>
                <div className="grid grid-cols-4 gap-2 pt-2">
                  {(
                    [
                      ["gotIt", 41],
                      ["tooFast", 26],
                      ["tooSlow", 3],
                      ["example", 9],
                    ] as const
                  ).map(([r, n]) => (
                    <div key={r} className="flex flex-col items-center gap-1 rounded-2xl bg-white/15 py-3 text-center">
                      <IconBadge icon={REACTION_ICON[r].icon} tone={REACTION_ICON[r].tone} size="sm" />
                      <div className="font-semibold">{n}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="card absolute -bottom-6 -left-2 hidden px-5 py-3 sm:block">
              <span className="text-sm text-muted">Top question</span>
              <p className="flex items-center gap-2 font-semibold">
                <IconBadge icon={Trophy} tone="sun" size="xs" /> “TLB vs page table?” · 42 <ChevronUp size={16} strokeWidth={2.75} />
              </p>
            </div>
          </section>
        </div>

        {/* The problem */}
        <Reveal>
        <section className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4 px-4 text-center sm:px-6">
          <IconBadge icon={HandHelping} tone="sun" size="xl" />
          <h2 className="poster text-5xl sm:text-6xl">Most confused students never raise their hand.</h2>
          <p className="max-w-2xl text-lg font-light text-text2">
            Asking in front of 100 classmates feels risky, so confusion stays hidden until the exam, and end-of-term feedback arrives too late to help.
          </p>
        </section>
        </Reveal>

        {/* How it works */}
        <Reveal>
        <section id="how" className="mx-auto flex w-full max-w-6xl scroll-mt-8 flex-col gap-8 px-4 sm:px-6">
          <h2 className="poster text-5xl sm:text-6xl">How it works</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {[
              ["bg-sun", "Show the QR code", "Create a lecture in seconds and put the code on your slides."],
              ["bg-sky", "Students tap and ask", "Got it, confused, too fast, too slow, or a question. Nobody sees who sent it."],
              ["bg-lime", "You see it live", "An Understanding score, grouped questions and alerts, then a report after class."],
            ].map(([c, title, body], i) => (
              <li key={title} className="card flex flex-col gap-3 p-6">
                <span className={`badge text-xl text-[#121212] ${c}`}>{i + 1}</span>
                <h3 className="text-2xl font-semibold">{title}</h3>
                <p className="font-light text-text2">{body}</p>
              </li>
            ))}
          </ol>
        </section>
        </Reveal>

        {/* Two audiences */}
        <Reveal>
        <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 sm:px-6 md:grid-cols-2">
          <Link href="/students" className="card group flex flex-col gap-3 p-8 transition hover:shadow-float">
            <span className="eyebrow">For students</span>
            <h3 className="poster text-4xl">Ask without the awkward.</h3>
            <p className="font-light text-text2">No app, no login, and nobody knows it was you.</p>
            <span className="font-semibold group-hover:underline">See how it works for students →</span>
          </Link>
          <Link href="/teachers" className="card group flex flex-col gap-3 p-8 transition hover:shadow-float">
            <span className="eyebrow">For teachers</span>
            <h3 className="poster text-4xl">See the room, not just the front row.</h3>
            <p className="font-light text-text2">Live understanding, grouped questions and a report after every lecture.</p>
            <span className="font-semibold group-hover:underline">See what teachers get →</span>
          </Link>
        </section>
        </Reveal>

        {/* Preview */}
        <Reveal>
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 sm:px-6">
          <h2 className="poster text-5xl sm:text-6xl">See it in action</h2>
          <div className="grid items-center gap-8 lg:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center gap-2">
              <PhoneMock />
              <span className="text-sm text-muted">Student phone</span>
            </div>
            <div className="flex flex-col gap-2">
              <DashboardMock />
              <span className="text-sm text-muted">Teacher dashboard · example lecture</span>
            </div>
          </div>
        </section>
        </Reveal>

        <p className="mx-auto max-w-3xl px-4 text-center text-lg">
          <Ico icon={Lock} size={18} className="mr-1.5" />
          Students stay anonymous: no accounts, names or emails.{" "}
          <Link href="/privacy" className="font-semibold underline">
            Read our privacy promise
          </Link>
        </p>

        {/* Final CTA */}
        <Reveal>
        <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-4xl bg-coral p-10 text-center text-white">
            <Confetti />
            <div className="relative flex flex-col items-center gap-4">
              <IconBadge icon={Hand} tone="card" size="xl" className="-rotate-12" />
              <h2 className="poster text-5xl sm:text-6xl">Run your next lecture with HandsUp.</h2>
              <p className="text-lg text-white/90">Set up in under a minute with your Google account.</p>
              <Link href="/login" className="pill mt-2 py-3.5 text-lg">
                Start a free class →
              </Link>
            </div>
          </div>
        </section>
        </Reveal>
      </main>
      <PublicFooter />
    </>
  );
}
