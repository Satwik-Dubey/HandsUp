/** Decorative confetti strips for coral hero cards (from the template). */
const STRIPS = [
  { top: "8%", left: "58%", rot: -25, color: "#F2C94C" },
  { top: "14%", left: "84%", rot: 40, color: "#9CCADF" },
  { top: "30%", left: "72%", rot: -60, color: "#8CC56C" },
  { top: "6%", left: "40%", rot: 70, color: "#F3A9B7" },
  { top: "34%", left: "90%", rot: -10, color: "#FBFAF7" },
  { top: "22%", left: "62%", rot: 15, color: "#9A7CEB" },
];

export function Confetti() {
  return (
    <div className="confetti pointer-events-none absolute inset-0" aria-hidden>
      {STRIPS.map((s, i) => (
        <b key={i} style={{ top: s.top, left: s.left, transform: `rotate(${s.rot}deg)`, background: s.color, opacity: 0.85 }} />
      ))}
    </div>
  );
}
