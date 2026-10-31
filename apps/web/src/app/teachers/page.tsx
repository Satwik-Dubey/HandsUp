import { Reveal } from "@/components/motion/Reveal";
import { SESSION_TEMPLATES, TEMPLATE_META } from "@handsup/shared";
import { BarChart3, FileText, Hand, Library, Lock, Rabbit, ShieldCheck, TrendingUp, TriangleAlert, Trophy, type LucideIcon } from "lucide-react";
import { IconBadge, TEMPLATE_ICON, type Tone } from "@/components/icons";
import Link from "next/link";
import { DashboardMock } from "@/components/Mockups";
import { Faq, PublicFooter, PublicHeader } from "@/components/PublicHeader";

export const metadata = { title: "For teachers", description: "Live understanding, grouped questions and a report after every lecture. Free." };

const FEATURES: [LucideIcon, Tone, string, string][] = [
  [TrendingUp, "violet", "Understanding score", "0 to 100, live, with slide markers so you know where it dipped."],
  [TriangleAlert, "coral", "Confusion alerts", "A nudge the moment confusion spikes or engagement drops."],
  [Trophy, "sun", "Top questions", "AI groups similar questions, so you answer the one 42 students share."],
  [Rabbit, "sky", "Pace check", "See when the class says too fast or too slow."],
  [BarChart3, "lime", "Quick polls", "Prepare them in advance, launch with one tap."],
  [FileText, "pink", "After-class report", "AI summary, key moments, most-asked questions, PDF and CSV."],
  [Library, "forest", "Course view", "Compare lectures across the term and spot hard topics."],
  [ShieldCheck, "ink", "Moderation", "Profanity filter, one-tap hide, mute, optional review first."],
];

export default function TeachersPage() {
  return (
    <>
      <PublicHeader />
      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 pb-20 pt-6 sm:px-6">
        <section className="animate-fade-up grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-6">
            <span className="eyebrow">For teachers</span>
            <h1 className="poster text-6xl sm:text-7xl">
              See the room, not just
              <br />
              the front row.
            </h1>
            <p className="max-w-xl text-lg font-light text-text2">
              Every student can tell you they&apos;re lost, anonymously. You get a live understanding score, the questions most of the class shares, and a
              report after every lecture.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/login" className="pill-coral py-3.5 text-lg">
                Start a free class →
              </Link>
            </div>
          </div>
          <DashboardMock />
        </section>

        <Reveal>
        <section className="flex flex-col gap-6">
          <h2 className="poster text-5xl">What you get</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(([icon, tone, t, b]) => (
              <div key={t} className="card flex flex-col gap-2 p-6">
                <IconBadge icon={icon} tone={tone} size="lg" />
                <h3 className="text-xl font-semibold">{t}</h3>
                <p className="font-light text-text2">{b}</p>
              </div>
            ))}
          </div>
        </section>
        </Reveal>

        <Reveal>
        <section className="flex flex-col gap-6">
          <h2 className="poster text-5xl">One lecture with HandsUp</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["bg-sun", "Before", ["Create the lecture in your course", "Prepare 2 or 3 polls", "Add the QR code to your first slide"]],
              ["bg-coral text-white", "During", ["Students scan and join", "Watch understanding on a second screen or your phone", "Answer the top question when an alert fires"]],
              ["bg-lime", "After", ["Read the AI summary and key moments", "Export questions to plan the next class", "Compare with earlier lectures"]],
            ].map(([c, t, items]) => (
              <div key={t as string} className={`flex flex-col gap-3 rounded-3xl p-6 ${c} ${c === "bg-coral text-white" ? "" : "text-[#121212]"}`}>
                <h3 className="poster text-4xl">{t as string}</h3>
                <ul className="list-disc pl-5">
                  {(items as string[]).map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
        </Reveal>

        <Reveal>
        <section className="grid gap-4 md:grid-cols-2">
          <div className="card flex flex-col gap-3 p-6">
            <h3 className="flex items-center gap-2 text-xl font-semibold">
              <IconBadge icon={Lock} tone="ink" size="sm" /> Privacy and control
            </h3>
            <ul className="list-disc pl-5 font-light text-text2">
              <li>Students stay anonymous, with no accounts</li>
              <li>You choose how long data is kept</li>
              <li>Delete a lecture&apos;s data at any time</li>
            </ul>
          </div>
          <div className="card flex flex-col gap-3 p-6">
            <h3 className="text-xl font-semibold">Works for</h3>
            <ul className="flex flex-wrap gap-2">
              {SESSION_TEMPLATES.map((t) => (
                <li key={t} className="flex items-center gap-1.5 rounded-full bg-paper py-1 pl-1 pr-3 font-medium">
                  <IconBadge icon={TEMPLATE_ICON[t]} tone="card" size="xs" /> {t === "lecture" ? "Large lectures" : TEMPLATE_META[t].label}
                </li>
              ))}
            </ul>
            <p className="font-light text-text2">From 30 to 500 students. Works with any slides, since students only need the QR code.</p>
          </div>
        </section>
        </Reveal>

        <Reveal>
        <section className="flex flex-col gap-4">
          <h2 className="poster text-5xl">Teachers ask</h2>
          <Faq q="Is it really free?">
            Yes. HandsUp runs on free tiers: small AI models run on our own server, and the hosted AI it uses for live insights and reports has free limits
            that cover normal classes.
          </Faq>
          <Faq q="What if students misuse it?">
            Taps are rate-limited per phone, rude words are blocked automatically, and you can hide any question with one tap, mute a student (without knowing
            who they are), or turn on “review questions first”.
          </Faq>
          <Faq q="Do I need to change my slides?">
            Only to add the QR code, which you can download from the lecture page. You can also press “Show QR” full screen at the start of class.
          </Faq>
          <Faq q="What if the campus Wi-Fi is bad?">
            Phones batch their taps and send them when they can, and rejoin by themselves after a drop. HandsUp works on mobile data too: it uses very little.
          </Faq>
        </section>
        </Reveal>

        <Reveal>
        <section className="card flex flex-col items-center gap-4 p-10 text-center">
          <IconBadge icon={Hand} tone="coral" size="xl" className="-rotate-12" />
          <h2 className="poster text-5xl">Ready in 60 seconds.</h2>
          <p className="text-lg text-text2">Sign in with Google, name your course, show the QR.</p>
          <Link href="/login" className="pill-coral py-3.5 text-lg">
            Start a free class →
          </Link>
        </section>
        </Reveal>
      </main>
      <PublicFooter />
    </>
  );
}
