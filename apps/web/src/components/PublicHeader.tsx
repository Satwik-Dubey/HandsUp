import { Menu } from "lucide-react";
import { currentTeacher } from "@/auth";
import { initials } from "@/lib/utils";
import { Wordmark } from "./Logo";
import Link from "next/link";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/students", label: "For students" },
  { href: "/teachers", label: "For teachers" },
  { href: "/privacy", label: "Privacy" },
];

/** Top bar of the public pages: both doors (students join, teachers sign in) always visible. A signed-in teacher gets "My courses" instead of "Sign in". */
export async function PublicHeader() {
  const t = await currentTeacher();
  const name = t ? (t.displayName ?? t.name ?? t.email) : "";
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-5 sm:px-6">
      <Logo />
      <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Main">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="rounded-full px-3 py-2 font-medium text-text2 hover:bg-card hover:text-ink">
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="flex-1" />
      <Link href="/join" className="pill-ghost pill-sm hidden sm:inline-flex">
        Join a class
      </Link>
      {t ? (
        <Link href="/courses" className="pill pill-sm gap-2 py-1 pl-1" title={`Signed in as ${name}`}>
          {t.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.image} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <span aria-hidden className="badge h-7 w-7 bg-violet text-xs">
              {initials(name)}
            </span>
          )}
          My courses
        </Link>
      ) : (
        <Link href="/login" className="pill pill-sm">
          Sign in
        </Link>
      )}
      <ThemeToggle />
      <details className="relative lg:hidden">
        <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full bg-card shadow-soft" aria-label="Menu">
          <Menu size={19} strokeWidth={2.25} />
        </summary>
        <nav className="card absolute right-0 z-30 mt-2 flex w-52 flex-col p-2" aria-label="Main">
          {[...NAV, { href: "/join", label: "Join a class" }, ...(t ? [{ href: "/courses", label: "My courses" }] : [])].map((n) => (
            <Link key={n.href} href={n.href} className="rounded-2xl px-3 py-2 hover:bg-paper">
              {n.label}
            </Link>
          ))}
        </nav>
      </details>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 text-sm text-muted sm:px-6">
        <span className="font-semibold text-ink">
          <Wordmark size={22} />
        </span>
        <span>Live, anonymous feedback for classrooms.</span>
        <div className="flex-1" />
        <Link href="/students" className="hover:text-ink">
          For students
        </Link>
        <Link href="/teachers" className="hover:text-ink">
          For teachers
        </Link>
        <Link href="/privacy" className="hover:text-ink">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-ink">
          Terms
        </Link>
      </div>
    </footer>
  );
}

/** A FAQ entry that opens in place. */
export function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="card group p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
        {q}
        <span className="text-2xl text-muted transition group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>
      <div className="mt-3 font-light text-text2">{children}</div>
    </details>
  );
}
