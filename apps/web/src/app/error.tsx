"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { IconBadge } from "@/components/icons";

/** Shown when a page throws. Next keeps the layout, so this only replaces the page body. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex min-h-[60dvh] w-full max-w-xl flex-col items-center justify-center gap-4 px-5 text-center">
      <IconBadge icon={TriangleAlert} tone="coral" size="xl" />
      <h1 className="poster text-5xl">Something went wrong</h1>
      <p className="max-w-sm font-light text-text2">It&apos;s probably a hiccup. Try again; if it keeps happening, check that the database and the live server are running.</p>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <button className="pill" onClick={reset}>
          Try again
        </button>
        <Link href="/" className="pill-ghost">
          Home
        </Link>
      </div>
    </main>
  );
}
