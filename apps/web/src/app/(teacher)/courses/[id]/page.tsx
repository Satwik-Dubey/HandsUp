import { ManageMenu } from "@/components/ManageMenu";
import { deleteCourse, renameCourse } from "../../actions";
import { FileDown, Library, Plus, Sheet, TrendingUp } from "lucide-react";
import { GraduationCap } from "lucide-react";
import { Ico, IconBadge, TEMPLATE_ICON } from "@/components/icons";
import { desc, eq, sessions } from "@handsup/db";
import { TEMPLATE_META, type SessionTemplate } from "@handsup/shared";
import Link from "next/link";
import { db } from "@/lib/db";
import { courseLectures, type PastLecture } from "@/lib/report";
import { requireCourse } from "@/lib/teacher";
import { colorClass, formatDate, initials } from "@/lib/utils";

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { course } = await requireCourse((await params).id);
  const [lectures, ended] = await Promise.all([
    db.query.sessions.findMany({
      where: eq(sessions.courseId, course.id),
      orderBy: [desc(sessions.createdAt)],
    }),
    courseLectures(course.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <Link href="/courses" className="text-muted hover:text-ink">
        ← Courses
      </Link>
      <div className="flex flex-wrap items-center gap-5">
        <span className={`badge h-16 w-16 text-xl ${colorClass(course.color)}`}>{initials(course.name) || <Library size={28} strokeWidth={2.25} />}</span>
        <div className="min-w-0 flex-1">
          <h1 className="poster text-5xl sm:text-6xl">{course.name}</h1>
          {course.term && <p className="text-muted">{course.term}</p>}
        </div>
        <Link href={`/sessions/new?course=${course.id}`} className="pill-coral py-3 text-lg">
          <Plus size={18} strokeWidth={2.5} aria-hidden /> New lecture
        </Link>
        <ManageMenu
          what="course"
          name={course.name}
          extra={{ label: "Term (optional)", value: course.term ?? "", placeholder: "e.g. Fall 2026" }}
          rename={renameCourse.bind(null, course.id)}
          remove={deleteCourse.bind(null, course.id)}
          deleteWarning={`Its ${lectures.length} ${lectures.length === 1 ? "lecture" : "lectures"}, reports and class data are deleted too.`}
          afterDelete="/courses"
        />
      </div>

      {ended.filter((l) => l.stats).length >= 1 && (
        <>
          <CourseComparison lectures={ended} />
          <div className="-mt-4 flex flex-wrap items-center gap-2">
            <a className="pill-ghost" href={`/api/courses/${course.id}/term?format=pdf`}>
              <FileDown size={17} strokeWidth={2.25} aria-hidden /> Download term report
            </a>
            <a className="pill-ghost" href={`/api/courses/${course.id}/term?format=csv`}>
              <Sheet size={17} strokeWidth={2.25} aria-hidden /> Term CSV
            </a>
            <span className="text-sm text-muted">Every lecture so far in one PDF: trends, highlights and what students asked most.</span>
          </div>
        </>
      )}

      {lectures.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <IconBadge icon={GraduationCap} tone="sun" size="xl" />
          <p className="text-xl font-semibold">No lectures yet</p>
          <p className="max-w-sm font-light text-text2">Create one, put its QR code on your first slide, and go live when class starts.</p>
          <Link href={`/sessions/new?course=${course.id}`} className="pill mt-2">
            Create your first lecture →
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {lectures.map((s, i) => {
            const meta = TEMPLATE_META[s.template as SessionTemplate] ?? TEMPLATE_META.lecture;
            return (
              <li key={s.id}>
                <Link
                  href={s.status === "live" ? `/sessions/${s.id}/live` : s.status === "ended" ? `/sessions/${s.id}/report` : `/sessions/${s.id}`}
                  className="card flex items-center gap-4 p-4 transition hover:shadow-float"
                >
                  <span className="badge bg-ink text-on-ink">{lectures.length - i}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold">{s.title}</p>
                    <p className="flex flex-wrap items-center gap-1 text-sm text-muted">
                      <Ico icon={TEMPLATE_ICON[s.template as SessionTemplate] ?? TEMPLATE_ICON.lecture} size={15} /> {meta.label} · {formatDate(s.startedAt ?? s.startsAt ?? s.createdAt)} · code {s.joinCode}
                    </p>
                  </div>
                  <StatusChip status={s.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  if (status === "live") return <span className="rounded-full bg-coral px-3 py-1 text-sm font-semibold text-white">● LIVE</span>;
  if (status === "ended") return <span className="rounded-full bg-paper px-3 py-1 text-sm text-muted">Ended</span>;
  return <span className="rounded-full bg-sun/30 px-3 py-1 text-sm">Draft</span>;
}

/** Lecture-by-lecture comparison: understanding as bars, the rest in a table. */
function CourseComparison({ lectures }: { lectures: PastLecture[] }) {
  const rows = [...lectures].filter((l) => l.stats).reverse(); // oldest first
  const best = Math.max(...rows.map((l) => l.stats!.avgUnderstanding ?? 0));
  const pct = (x: number | null | undefined) => (x === null || x === undefined ? "–" : `${Math.round(x * 100)}%`);
  return (
    <section className="card flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2.5 text-xl font-semibold">
          <IconBadge icon={TrendingUp} tone="violet" size="sm" /> How the course is going
        </h2>
        <span className="text-sm text-muted">Average understanding per lecture</span>
      </div>
      <div className="flex h-44 items-end gap-2 overflow-x-auto pb-1" role="img" aria-label="Average understanding per lecture">
        {rows.map((l, i) => {
          const u = l.stats!.avgUnderstanding;
          return (
            <Link key={l.id} href={`/sessions/${l.id}/report`} className="group flex min-w-12 flex-1 flex-col items-center justify-end gap-1" title={l.title}>
              <span className="text-sm font-semibold tabular-nums">{u ?? "–"}</span>
              <span
                className={`w-full rounded-t-xl transition group-hover:opacity-80 ${u !== null && u === best ? "bg-coral" : "bg-sky"}`}
                style={{ height: `${Math.max(4, ((u ?? 0) / 100) * 120)}px` }}
              />
              <span className="text-xs text-muted">L{i + 1}</span>
            </Link>
          );
        })}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-1 font-normal">Lecture</th>
              <th className="py-1 font-normal">People</th>
              <th className="py-1 font-normal">Understanding</th>
              <th className="py-1 font-normal">Engaged</th>
              <th className="py-1 font-normal">Questions</th>
              <th className="py-1 font-normal">Clarity</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((l) => (
              <tr key={l.id} className="border-t border-line">
                <td className="py-2">
                  <Link href={`/sessions/${l.id}/report`} className="font-semibold hover:underline">
                    {l.title}
                  </Link>
                  <span className="block text-xs text-muted">{formatDate(l.date)}</span>
                </td>
                <td className="py-2 tabular-nums">{l.stats!.joined}</td>
                <td className="py-2 tabular-nums">{l.stats!.avgUnderstanding ?? "–"}</td>
                <td className="py-2 tabular-nums">{pct(l.stats!.avgEngaged)}</td>
                <td className="py-2 tabular-nums">{l.stats!.questions}</td>
                <td className="py-2 tabular-nums">{l.stats!.clarity === null ? "–" : `${l.stats!.clarity.toFixed(1)}/5`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
