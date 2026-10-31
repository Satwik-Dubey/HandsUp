import { PublicFooter, PublicHeader } from "@/components/PublicHeader";

export const metadata = { title: "Terms", description: "The simple terms for using HandsUp." };

export default function TermsPage() {
  return (
    <>
      <PublicHeader />
      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-20 pt-6 font-light text-text2 sm:px-6">
        <h1 className="poster text-6xl text-ink">Terms of use</h1>
        <p>HandsUp is provided free of charge, as is, for use in teaching. By using it you agree to these simple rules:</p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>Use it for teaching and learning. Don&apos;t use it to harass anyone or to collect personal information from students.</li>
          <li>Students: be respectful. Teachers can hide questions and mute anyone who isn&apos;t.</li>
          <li>Teachers are responsible for the lectures and polls they create, and for following their institution&apos;s rules.</li>
          <li>The service may change or have downtime. Keep your own copy of anything important (reports can be downloaded as PDF and CSV).</li>
        </ul>
        <p>See the privacy page for what data is kept and for how long.</p>
      </main>
      <PublicFooter />
    </>
  );
}
