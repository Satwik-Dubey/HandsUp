import { Reveal } from "@/components/motion/Reveal";
import { BarChart3, CircleHelp, Eye, EyeOff, Hand, Rabbit, Trophy, type LucideIcon } from "lucide-react";
import { IconBadge, type Tone } from "@/components/icons";
import { JoinCodeBox } from "@/components/JoinCodeBox";
import { PhoneMock } from "@/components/Mockups";
import { Faq, PublicFooter, PublicHeader } from "@/components/PublicHeader";

export const metadata = { title: "For students", description: "Tell your teacher when you're lost, anonymously. No app, no account." };

export default function StudentsPage() {
  return (
    <>
      <PublicHeader />
      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 pb-20 pt-6 sm:px-6">
        <section className="animate-fade-up grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col gap-6">
            <span className="eyebrow">For students</span>
            <h1 className="poster text-6xl sm:text-7xl">
              Confused? Say it
              <br />
              without raising your hand.
            </h1>
            <p className="max-w-xl text-lg font-light text-text2">
              Tell your teacher when you&apos;re lost, when it&apos;s too fast, or ask a question. No app, no account, and nobody knows it was you.
            </p>
            <JoinCodeBox />
          </div>
          <PhoneMock />
        </section>

        <Reveal>
        <section className="flex flex-col gap-6">
          <h2 className="poster text-5xl">Join in 10 seconds</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {[
              ["Scan the QR code", "It's on your teacher's slide. No QR? Go to the Join page and type the 6-character code."],
              ["Tap “Join anonymously”", "No sign-up, no email, no app to install."],
              ["React any time", "Keep the tab open during class. Lost signal? You rejoin automatically, as the same anonymous student."],
            ].map(([t, b], i) => (
              <li key={t} className="card flex flex-col gap-2 p-6">
                <span className="badge bg-ink text-on-ink">{i + 1}</span>
                <h3 className="text-xl font-semibold">{t}</h3>
                <p className="font-light text-text2">{b}</p>
              </li>
            ))}
          </ol>
        </section>
        </Reveal>

        <Reveal>
        <section className="flex flex-col gap-6">
          <h2 className="poster text-5xl">What you can do</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
              [CircleHelp, "sun", "Say you're lost", "One big “I'm confused” button. Your teacher sees how many, never who."],
              [Rabbit, "sky", "Fix the pace", "Too fast, too slow, or “give an example please”."],
              [Trophy, "pink", "Ask and upvote", "Ask a question or upvote one you also have. The top ones get answered."],
              [BarChart3, "lime", "Vote in polls", "Answer quick polls and see how the class voted."],
              ] as [LucideIcon, Tone, string, string][]
            ).map(([icon, tone, t, b]) => (
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
        <section className="grid gap-4 md:grid-cols-2">
          <div className="card flex flex-col gap-3 p-6">
            <h3 className="flex items-center gap-2 text-xl font-semibold">
              <IconBadge icon={Eye} tone="lime" size="sm" /> Your teacher sees
            </h3>
            <ul className="list-disc pl-5 font-light text-text2">
              <li>How many students tapped each button</li>
              <li>The text of questions and their upvotes</li>
              <li>Poll totals and the class&apos;s understanding score</li>
            </ul>
          </div>
          <div className="card flex flex-col gap-3 p-6">
            <h3 className="flex items-center gap-2 text-xl font-semibold">
              <IconBadge icon={EyeOff} tone="coral" size="sm" /> Your teacher never sees
            </h3>
            <ul className="list-disc pl-5 font-light text-text2">
              <li>Your name, email or phone number</li>
              <li>Who asked a question or pressed a button</li>
              <li>Anything that links you across classes</li>
            </ul>
          </div>
        </section>
        </Reveal>

        <Reveal>
        <section className="flex flex-col gap-4">
          <h2 className="poster text-5xl">Students ask</h2>
          <Faq q="Will my teacher know it's me?">
            No. HandsUp never asks for your name or email. Your phone gets a random ID that is scrambled differently for every class, so even we can&apos;t
            link you from one lecture to the next.
          </Faq>
          <Faq q="Does it cost anything?">No. It&apos;s free, and there&apos;s nothing to install.</Faq>
          <Faq q="What if my phone loses signal?">
            Keep the tab open. When the signal comes back you rejoin automatically as the same anonymous student, and taps you made offline are sent then.
          </Faq>
          <Faq q="Can I delete my question?">
            Not yet from the phone, but your teacher can hide any question, and everything students send is deleted automatically after the period your
            teacher picked (30 days by default).
          </Faq>
        </section>
        </Reveal>

        <Reveal>
        <section className="card flex flex-col items-center gap-4 p-10 text-center">
          <IconBadge icon={Hand} tone="coral" size="xl" className="-rotate-12" />
          <h2 className="poster text-4xl">Got a class code?</h2>
          <JoinCodeBox />
          <p className="text-muted">No code? Ask your teacher to put HandsUp on the next slide.</p>
        </section>
        </Reveal>
      </main>
      <PublicFooter />
    </>
  );
}
