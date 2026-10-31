import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { requireTeacher } from "@/lib/teacher";
import { Setup } from "./Setup";

export const metadata = { title: "Welcome" };

/** First-time setup: about you, first course, try it. Shown once, after the first sign-in. */
export default async function WelcomePage() {
  const t = await requireTeacher();
  if (t.onboardedAt) redirect("/courses");
  const last = (t.name ?? "").trim().split(/\s+/).pop();
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-5 sm:px-6">
        <Logo href="/courses" />
        <div className="flex-1" />
        <ThemeToggle />
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
        <Setup
          defaults={{
            displayName: t.displayName ?? (last ? `Prof. ${last}` : ""),
            fullName: t.name ?? t.email,
            institution: t.institution ?? "",
            image: t.image,
          }}
        />
      </main>
    </div>
  );
}
