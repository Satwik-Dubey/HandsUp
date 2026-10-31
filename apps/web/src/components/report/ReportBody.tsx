import { Trophy } from "lucide-react";
import { IconBadge } from "@/components/icons";
import { formatOffset, type KeyMoment, type ReportView, type SegmentView } from "@handsup/shared";
import Link from "next/link";
import { Confetti } from "@/components/Confetti";
import { Timeline, TimelineLegend } from "@/components/Timeline";
import type { PastLecture } from "@/lib/report";
import type { TimelinePoint } from "@/stores/live";

const PODIUM = ["bg-sun", "bg-sky", "bg-pink"];
const MOMENT_DOT: Record<KeyMoment["kind"], string> = {
  peak: "bg-lime",
  confusion: "bg-coral",
  drop: "bg-coral",
  pace: "bg-sky",
  poll: "bg-violet",
  recovery: "bg-forest",
};

/** The after-class report. Used by the teacher's page and the public share link. */
export function ReportBody({
  report,
  series,
  segments,
  past,
  linkPast = true,
}: {
  report: ReportView;
  series: TimelinePoint[];
  segments: SegmentView[];
  past: PastLecture[];
  /** Past lectures link to their reports (teacher only). */
  linkPast?: boolean;
}) {
  const st = report.stats;
  const pct = (x: number | null | undefined) => (x === null || x === undefined ? "–" : `${Math.round(x * 100)}%`);
  const top = report.topQuestions;

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-[28px] bg-coral p-6 text-white sm:p-8">
        <Confetti />
        <p className="relative text-sm font-semibold uppercase tracking-wide opacity-90">
          AI summary{report.summarySource === "template" ? " · written from your class data" : ""}
        </p>
        <p className="relative mt-3 max-w-3xl text-lg leading-relaxed sm:text-xl">{report.summaryMd}</p>
      </section>

      {st && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Stat badge="bg-sky" label="Peak audience" value={String(st.peakAudience)} sub={`${st.joined} joined`} />
          <Stat badge="bg-lime" label="Avg engaged" value={pct(st.avgEngaged)} sub="reacted each minute" />
          <Stat badge="bg-violet" label="Understanding" value={st.avgUnderstanding === null ? "–" : String(st.avgUnderstanding)} sub="average, out of 100" />
          <Stat badge="bg-coral" label="Questions" value={String(st.questions)} sub={`${st.answered} answered`} />
          <Stat badge="bg-sun" label="Clarity" value={st.clarity === null ? "–" : `${st.clarity.toFixed(1)}/5`} sub={`${st.durationMin} min lecture`} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="card flex flex-col gap-3 self-start p-6">
          <h2 className="text-xl font-semibold">Understanding across the lecture</h2>
          <Timeline points={series} segments={segments} startedAt={report.startedAt} stepMs={60_000} />
          <TimelineLegend />
        </section>

        <section className="card flex flex-col gap-4 p-6">
          <h2 className="flex items-center gap-2.5 text-xl font-semibold">
          <IconBadge icon={Trophy} tone="sun" size="sm" /> Most asked
        </h2>
          {top.length === 0 ? (
            <p className="py-6 text-center text-muted">No questions this time.</p>
          ) : (
            <>
              <ol className="grid grid-cols-3 items-end gap-2" aria-label="Top three topics">
                {[1, 0, 2].map((rank) => {
                  const q = top[rank];
                  if (!q) return <li key={rank} />;
                  return (
                    <li key={rank} className="flex flex-col items-center gap-1 text-center">
                      <span className="line-clamp-2 text-sm font-medium">{q.label}</span>
                      <span className="text-xs text-muted">{q.people} {q.people === 1 ? "student" : "students"}</span>
                      <span
                        className={`flex w-full items-start justify-center rounded-t-2xl pt-2 text-2xl font-semibold text-[#121212] ${PODIUM[rank]}`}
                        style={{ height: [72, 52, 40][rank] }}
                      >
                        {rank + 1}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <ul className="flex flex-col gap-2">
                {top.map((q, i) => (
                  <li key={i} className="rounded-2xl bg-paper p-3">
                    <p className="font-semibold">
                      {q.label} <span className="font-normal text-muted">· {q.people}</span>
                    </p>
                    {q.size > 1 && <p className="truncate text-sm text-muted">e.g. “{q.sample}”</p>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card flex flex-col gap-3 p-6">
          <h2 className="text-xl font-semibold">Key moments</h2>
          {report.keyMoments.length === 0 ? (
            <p className="py-4 text-muted">Nothing stood out: a steady lecture.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {report.keyMoments.map((m, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-14 flex-none pt-0.5 font-semibold tabular-nums">{formatOffset(m.offsetMs)}</span>
                  <span className={`mt-1.5 h-3 w-3 flex-none rounded-full ${MOMENT_DOT[m.kind]}`} aria-hidden />
                  <span>
                    <span className="block font-semibold">{m.title}</span>
                    <span className="block text-sm text-text2">{m.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card flex flex-col gap-3 p-6">
          <h2 className="text-xl font-semibold">Slide by slide</h2>
          {report.segments.length === 0 ? (
            <p className="py-4 text-muted">Press “Next slide ▸” during class to see understanding per slide here.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="py-1 font-normal">Slide</th>
                  <th className="py-1 font-normal">Starts</th>
                  <th className="py-1 font-normal">Understanding</th>
                  <th className="py-1 font-normal">Confused peak</th>
                  <th className="py-1 font-normal">Questions</th>
                </tr>
              </thead>
              <tbody>
                {report.segments.map((s, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="py-2 font-semibold">{s.label}</td>
                    <td className="py-2 tabular-nums">{formatOffset(s.startsAtMs)}</td>
                    <td className="py-2">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-16 overflow-hidden rounded-full bg-paper">
                          <span className="block h-full rounded-full bg-coral" style={{ width: `${s.avgUnderstanding ?? 0}%` }} />
                        </span>
                        {s.avgUnderstanding ?? "–"}
                      </span>
                    </td>
                    <td className="py-2">{Math.round(s.confusedPeak * 100)}%</td>
                    <td className="py-2">{s.questions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {past.length > 0 && (
        <section className="card flex flex-col gap-3 p-6">
          <h2 className="text-xl font-semibold">This course so far</h2>
          <ul className="flex flex-col gap-2">
            {past.slice(0, 6).map((p) => {
              const inner = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.title}</span>
                    <span className="block text-sm text-muted">
                      {new Date(p.date).toLocaleDateString("en", { month: "short", day: "numeric" })} · {p.stats?.joined ?? 0} people
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-semibold">{p.stats?.avgUnderstanding ?? "–"}</span>
                    <span className="block text-xs text-muted">understanding</span>
                  </span>
                </>
              );
              return (
                <li key={p.id}>
                  {linkPast ? (
                    <Link href={`/sessions/${p.id}/report`} className="flex items-center gap-3 rounded-2xl bg-paper p-3 hover:bg-line/40">
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 rounded-2xl bg-paper p-3">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ badge, label, value, sub }: { badge: string; label: string; value: string; sub: string }) {
  return (
    <div className="card flex flex-col gap-1 p-5">
      <div className="flex items-center gap-2">
        <span className={`h-3 w-3 rounded-full ${badge}`} aria-hidden />
        <span className="text-sm text-muted">{label}</span>
      </div>
      <span className="poster text-4xl tabular-nums sm:text-5xl">{value}</span>
      <span className="text-xs text-muted">{sub}</span>
    </div>
  );
}
