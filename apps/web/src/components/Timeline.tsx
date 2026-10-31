"use client";

import type { SegmentView } from "@handsup/shared";
import type { TimelinePoint } from "@/stores/live";

const W = 720;
const H = 230;
const PAD = { l: 30, r: 12, t: 26, b: 24 };
/** A window is a confusion spike when the confused share is at least this, and well above the lecture's usual level. */
const SPIKE_MIN = 0.15;
const SPIKE_X_BASELINE = 1.5;

function mmss(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Understanding (solid coral), Engaged % (dashed), confusion spikes (amber bands) and slide markers. */
export function Timeline({
  points,
  segments,
  startedAt,
  stepMs = 5000,
}: {
  points: TimelinePoint[];
  segments: SegmentView[];
  startedAt: number | null;
  /** Width of one point: 5 s live, 1 min in the report. */
  stepMs?: number;
}) {
  if (points.length < 2) {
    return (
      <div className="flex h-[230px] items-center justify-center rounded-2xl bg-paper px-6 text-center text-muted">
        {stepMs === 5000 ? "A point is added every 5 seconds once the class is live." : "No timeline was recorded for this lecture."}
      </div>
    );
  }
  const t0 = startedAt ?? points[0]!.bucket;
  const t1 = Math.max(points[points.length - 1]!.bucket + stepMs, t0 + 60_000);
  const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / 100) * (H - PAD.t - PAD.b);

  const path = (get: (p: TimelinePoint) => number | null) => {
    let d = "";
    let pen = false;
    for (const p of points) {
      const v = get(p);
      if (v === null || v === undefined) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${x(p.bucket + stepMs / 2).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    }
    return d;
  };

  // Baseline = the lecture's median confused share; spikes stand out from it. Consecutive spike windows merge into bands.
  const sorted = points.map((p) => p.confusedRatio).sort((a, b) => a - b);
  const baseline = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const threshold = Math.max(SPIKE_MIN, baseline * SPIKE_X_BASELINE);
  const bands: [number, number][] = [];
  for (const p of points) {
    if (p.confusedRatio < threshold) continue;
    const last = bands[bands.length - 1];
    if (last && last[1] === p.bucket) last[1] = p.bucket + stepMs;
    else bands.push([p.bucket, p.bucket + stepMs]);
  }

  const ticks = 4;
  const visibleSegs = segments.filter((s) => s.startsAt >= t0 && s.startsAt <= t1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Understanding over the lecture">
      {bands.map(([a, b], i) => (
        <rect key={i} x={x(a)} y={PAD.t} width={Math.max(2, x(b) - x(a))} height={H - PAD.t - PAD.b} fill="#F2C94C" opacity={0.25} />
      ))}
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="rgb(var(--line))" />
          <text x={4} y={y(v) + 4} fontSize={11} fill="rgb(var(--muted))">
            {v}
          </text>
        </g>
      ))}
      {visibleSegs.map((s) => (
        <g key={s.id}>
          <line x1={x(s.startsAt)} x2={x(s.startsAt)} y1={PAD.t - 4} y2={H - PAD.b} stroke="rgb(var(--muted))" strokeDasharray="2 3" />
          <text x={x(s.startsAt) + 3} y={PAD.t - 8} fontSize={11} fill="rgb(var(--ink))">
            {s.label}
          </text>
        </g>
      ))}
      <path d={path((p) => p.engaged * 100)} fill="none" stroke="rgb(var(--muted))" strokeWidth={1.5} strokeDasharray="4 4" />
      <path d={path((p) => p.understanding)} fill="none" stroke="#E0573F" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const t = t0 + ((t1 - t0) * i) / ticks;
        return (
          <text key={i} x={x(t)} y={H - 6} fontSize={11} fill="rgb(var(--muted))" textAnchor={i === 0 ? "start" : i === ticks ? "end" : "middle"}>
            {mmss(t - t0)}
          </text>
        );
      })}
    </svg>
  );
}

export function TimelineLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <i className="inline-block h-[3px] w-4 rounded bg-coral" /> Understanding
      </span>
      <span className="flex items-center gap-1.5">
        <i className="inline-block w-4 border-t-2 border-dashed border-muted" /> Engaged %
      </span>
      <span className="flex items-center gap-1.5">
        <i className="inline-block h-3 w-3 rounded-sm bg-sun/40" /> Confusion spike
      </span>
    </div>
  );
}
