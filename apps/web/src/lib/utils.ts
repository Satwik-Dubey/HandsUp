import { clsx, type ClassValue } from "clsx";
import type { CourseColor } from "@handsup/shared";

export const cn = (...v: ClassValue[]) => clsx(v);

export const COLOR_CLASS: Record<CourseColor, string> = {
  coral: "bg-coral",
  green: "bg-forest",
  yellow: "bg-sun",
  sky: "bg-sky",
  violet: "bg-violet",
  lime: "bg-lime",
  pink: "bg-pink",
};

export function colorClass(c: string) {
  return COLOR_CLASS[c as CourseColor] ?? "bg-coral";
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w[0] ?? ""))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Public URL used in QR codes and share links. */
export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function formatDate(d: Date | string | number | null | undefined) {
  if (d === null || d === undefined || d === "") return "";
  return new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(d));
}
