import { Library } from "lucide-react";
import { Ico } from "@/components/icons";
import Link from "next/link";
import { signOut } from "@/auth";
import { GatewayWake } from "@/components/GatewayWake";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { requireTeacher } from "@/lib/teacher";
import { initials } from "@/lib/utils";

export const metadata = { robots: { index: false, follow: false } };

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const t = await requireTeacher();
  const name = t.displayName ?? t.name ?? t.email;

  return (
    <div className="min-h-dvh">
      <GatewayWake />
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Logo />
          <nav className="ml-4 hidden items-center gap-1 sm:flex">
            <Link href="/courses" className="rounded-full px-4 py-2 font-medium hover:bg-card">
              <Ico icon={Library} size={17} className="mr-1.5" />
              Courses
            </Link>
          </nav>
          <div className="flex-1" />
          <ThemeToggle />
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full bg-card py-1 pl-1 pr-3 shadow-soft">
              {t.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.image} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <span className="badge h-8 w-8 bg-violet text-sm">{initials(name)}</span>
              )}
              <span className="hidden max-w-40 truncate sm:inline">{name}</span>
            </summary>
            <div className="card absolute right-0 mt-2 flex w-56 flex-col gap-1 p-2">
              <span className="truncate px-3 py-2 text-sm text-muted">{t.email}</span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button className="w-full rounded-2xl px-3 py-2 text-left hover:bg-paper">Sign out</button>
              </form>
            </div>
          </details>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
