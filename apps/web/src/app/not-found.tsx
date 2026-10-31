import { SearchX } from "lucide-react";
import Link from "next/link";
import { IconBadge } from "@/components/icons";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-10 px-5 py-6">
      <Logo />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-20 text-center">
        <IconBadge icon={SearchX} tone="sun" size="xl" />
        <h1 className="poster text-6xl">Nothing here</h1>
        <p className="max-w-sm text-lg font-light text-text2">This page doesn&apos;t exist, or it belongs to another teacher. Check the link, or start from one of these.</p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Link href="/" className="pill">
            Home
          </Link>
          <Link href="/join" className="pill-ghost">
            Join a class
          </Link>
          <Link href="/courses" className="pill-ghost">
            My courses
          </Link>
        </div>
      </div>
    </main>
  );
}
