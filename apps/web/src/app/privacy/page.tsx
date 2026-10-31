import { PublicFooter, PublicHeader } from "@/components/PublicHeader";

export const metadata = { title: "Privacy", description: "What HandsUp collects, what teachers see, and how long anything is kept." };

export default function PrivacyPage() {
  return (
    <>
      <PublicHeader />
      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pb-20 pt-6 sm:px-6">
        <h1 className="poster text-6xl">Our privacy promise</h1>
        <p className="text-lg font-light text-text2">
          HandsUp exists so students can speak up without being identified. This page explains exactly what is collected and for how long.
        </p>

        <Section title="Students">
          <li>Students never create an account. We don&apos;t ask for names, emails or phone numbers.</li>
          <li>
            Each phone gets a random ID. It is scrambled with a different secret for every lecture, so the same phone can&apos;t be linked across lectures, by
            teachers or by us.
          </li>
          <li>We store what students send: taps, questions, upvotes, poll votes and ratings, tied only to that per-lecture ID.</li>
          <li>Teachers see totals and the text of questions, never who sent anything.</li>
        </Section>

        <Section title="Teachers">
          <li>Teachers sign in with Google. We keep your name, email and profile photo, and nothing else from your Google account.</li>
          <li>We never post anything or read your Drive, Gmail or calendar.</li>
        </Section>

        <Section title="How long data is kept">
          <li>Raw taps are deleted after 7 days. Only per-5-second totals are kept for the timeline.</li>
          <li>
            Everything students sent is deleted after the period the teacher picks for each lecture (7, 30, 90 or 365 days; 30 by default). Teachers can also
            erase a lecture&apos;s student data at any time from its report.
          </li>
        </Section>

        <Section title="AI services">
          <li>Grouping questions and reading their tone runs on our own server, with small open models.</li>
          <li>
            For live insights and the after-class summary, short extracts (question text and class totals) are sent to Groq and Google Gemini. Emails, phone
            numbers and links are removed from question text first. No IDs are ever sent.
          </li>
        </Section>

        <Section title="Contact">
          <li>Questions or deletion requests: contact the person who runs this HandsUp server (usually your school or teacher).</li>
        </Section>
      </main>
      <PublicFooter />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card flex flex-col gap-3 p-6">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <ul className="flex list-disc flex-col gap-2 pl-5 font-light text-text2">{children}</ul>
    </section>
  );
}
