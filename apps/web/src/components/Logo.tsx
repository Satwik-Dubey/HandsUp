import { Hand } from "lucide-react";
import Link from "next/link";

/** The raised hand in a coral circle, used next to the HandsUp wordmark. */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <span aria-hidden className="inline-flex flex-none -rotate-12 items-center justify-center rounded-full bg-coral text-white" style={{ width: size, height: size }}>
      <Hand size={Math.round(size * 0.6)} strokeWidth={2.5} />
    </span>
  );
}

export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      HandsUp <LogoMark size={size} />
    </span>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center text-2xl font-semibold tracking-tight" aria-label="HandsUp home">
      <Wordmark size={30} />
    </Link>
  );
}
