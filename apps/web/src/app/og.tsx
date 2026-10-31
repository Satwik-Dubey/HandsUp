import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/** Shared drawing for the link-preview images (1200×630): coral card, poster headline, hand mark. */
export const OG_SIZE = { width: 1200, height: 630 };

const HAND = (
  <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#E0573F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
    <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
    <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
  </svg>
);

const STRIPS = [
  { top: 60, left: 640, rot: -25, color: "#F2C94C" },
  { top: 110, left: 1010, rot: 40, color: "#9CCADF" },
  { top: 250, left: 900, rot: -60, color: "#8CC56C" },
  { top: 40, left: 820, rot: 70, color: "#F3A9B7" },
  { top: 520, left: 1060, rot: -10, color: "#FBFAF7" },
  { top: 470, left: 700, rot: 15, color: "#9A7CEB" },
];

export async function ogImage({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  const anton = await readFile(join(process.cwd(), "assets/fonts/Anton-Regular.ttf"));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#EEEBE5", padding: 40 }}>
        <div style={{ position: "relative", display: "flex", flex: 1, flexDirection: "column", justifyContent: "space-between", background: "#E0573F", borderRadius: 48, padding: 64, color: "white", overflow: "hidden" }}>
          {STRIPS.map((s, i) => (
            <div key={i} style={{ position: "absolute", top: s.top, left: s.left, width: 70, height: 16, borderRadius: 8, background: s.color, transform: `rotate(${s.rot}deg)`, opacity: 0.9 }} />
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 96, height: 96, borderRadius: 48, background: "white", transform: "rotate(-12deg)" }}>{HAND}</div>
            <span style={{ fontFamily: "Anton", fontSize: 56 }}>HandsUp</span>
            <span style={{ marginLeft: 12, fontSize: 26, padding: "6px 18px", borderRadius: 999, background: "rgba(255,255,255,.2)" }}>{eyebrow}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <span style={{ fontFamily: "Anton", fontSize: 104, lineHeight: 0.95, maxWidth: 980 }}>{title}</span>
            <span style={{ fontSize: 34, opacity: 0.92 }}>{sub}</span>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: [{ name: "Anton", data: anton, weight: 400, style: "normal" }] },
  );
}
