import { Backpack, ChevronUp, CircleHelp, TrendingUp } from "lucide-react";
import { IconBadge } from "@/components/icons";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentTeacher, devLoginEnabled, googleEnabled, signIn } from "@/auth";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata = { title: "Sign in", description: "Teachers sign in with Google to create courses and run live lectures.", robots: { index: false } };

const ERRORS: Record<string, string> = {
  AccessDenied: "Your school account blocked HandsUp. Ask your IT team to allow it, or use a personal Google account.",
  Configuration: "Sign-in isn't set up correctly on this server. Check AUTH_SECRET and the Google keys in .env.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
  const { error, callbackUrl } = await searchParams;
  if (await currentTeacher()) redirect(callbackUrl?.startsWith("/") ? callbackUrl : "/courses");
  const redirectTo = callbackUrl?.startsWith("/") ? callbackUrl : "/courses";

  return (
    <main id="main" tabIndex={-1} className="mx-auto grid min-h-dvh w-full max-w-6xl gap-10 px-4 py-6 sm:px-6 lg:grid-cols-2 lg:items-center">
      <section className="flex flex-col gap-6">
        <div className="flex items-center justify-between lg:justify-start">
          <Logo />
          <ThemeToggle className="lg:hidden" />
        </div>
        <h1 className="poster hidden text-7xl lg:block">
          Your class is about to
          <br />
          start talking.
        </h1>
        <div className="hidden flex-col gap-2 lg:flex">
          <span className="card flex items-center gap-2 self-start px-4 py-2">
            <IconBadge icon={CircleHelp} tone="sun" size="xs" /> “wait, so the TLB is a cache?” · 42 <ChevronUp size={16} strokeWidth={2.75} />
          </span>
          <span className="card flex items-center gap-2 self-start px-4 py-2">
            <IconBadge icon={TrendingUp} tone="lime" size="xs" /> Understanding back up to 78
          </span>
        </div>
      </section>

      <section className="card mx-auto flex w-full max-w-md flex-col gap-5 p-7">
        <span className="eyebrow">For teachers</span>
        <h2 className="text-3xl font-semibold">Sign in to HandsUp</h2>
        <p className="font-light text-text2">New here? The same button creates your free account.</p>

        {error && (
          <p role="alert" className="rounded-2xl bg-coral/15 px-4 py-3 text-sm text-coral">
            {ERRORS[error] ?? "Sign-in didn't finish. Try again, or check that pop-ups are allowed."}
          </p>
        )}

        {googleEnabled ? (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo });
            }}
          >
            <button className="pill w-full py-3.5 text-base" type="submit">
              <GoogleG /> Continue with Google
            </button>
          </form>
        ) : (
          <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-muted">
            Google sign-in isn't configured yet. Add <code>AUTH_GOOGLE_ID</code> and <code>AUTH_GOOGLE_SECRET</code> to <code>.env</code> (see the README).
          </p>
        )}
        <p className="text-xs text-muted">We only use your name, email and photo. We never post anything or read your Drive or Gmail.</p>

        {devLoginEnabled && (
          <details className="rounded-2xl bg-paper p-4" open={!googleEnabled}>
            <summary className="cursor-pointer text-sm font-semibold">Developer sign-in (local only)</summary>
            <form
              className="mt-3 flex flex-col gap-2"
              action={async (fd: FormData) => {
                "use server";
                await signIn("dev", { name: fd.get("name"), email: fd.get("email"), redirectTo });
              }}
            >
              <input name="name" className="field" placeholder="Prof. Test" defaultValue="Prof. Test" />
              <input name="email" type="email" className="field" placeholder="you@example.com" defaultValue="teacher@example.com" required />
              <button className="pill-ghost" type="submit">
                Sign in as test teacher
              </button>
              <p className="text-xs text-muted">Shown because ALLOW_DEV_LOGIN=true. It never works in production.</p>
            </form>
          </details>
        )}

        <div className="flex items-center gap-3 rounded-2xl bg-paper p-4">
          <IconBadge icon={Backpack} tone="sky" size="md" />
          <div className="flex-1">
            <p className="font-semibold">Are you a student?</p>
            <p className="text-sm font-light text-text2">You don&apos;t need an account. Just enter your class code.</p>
          </div>
          <Link href="/join" className="pill pill-sm">
            Join a class →
          </Link>
        </div>
      </section>
    </main>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
