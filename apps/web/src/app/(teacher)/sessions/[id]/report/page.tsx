import { eq, reports } from "@handsup/db";
import Link from "next/link";
import { ReportBody } from "@/components/report/ReportBody";
import { db } from "@/lib/db";
import { courseLectures, minuteSeries, reportView, sessionSegments } from "@/lib/report";
import { requireOwnedSession } from "@/lib/teacher";
import { appUrl, formatDate } from "@/lib/utils";
import { ReportActions, ReportPending } from "./ReportActions";

export const metadata = { title: "Report" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { session, course } = await requireOwnedSession((await params).id);
  const [report, series, segments, past, share] = await Promise.all([
    reportView(session.id),
    minuteSeries(session.id),
    sessionSegments(session.id),
    courseLectures(course.id, session.id),
    db.query.reports.findFirst({ where: eq(reports.sessionId, session.id), columns: { shareToken: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <Link href={`/courses/${course.id}`} className="text-muted hover:text-ink">
            ← {course.name}
          </Link>
          <h1 className="poster text-5xl sm:text-6xl">Session recap</h1>
          <p className="text-lg text-text2">
            {session.title}
            {session.startedAt ? ` · ${formatDate(session.startedAt)}` : ""}
          </p>
        </div>
        {session.status === "ended" && report?.generatedAt && (
          <ReportActions sessionId={session.id} shareUrl={share?.shareToken ? `${appUrl()}/r/${share.shareToken}` : null} />
        )}
      </div>

      {session.status !== "ended" ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-xl font-semibold">The report is written when the class ends.</p>
          <Link href={`/sessions/${session.id}/live`} className="pill">
            Back to the dashboard
          </Link>
        </div>
      ) : !report?.generatedAt ? (
        <ReportPending />
      ) : (
        <ReportBody report={report} series={series} segments={segments} past={past} />
      )}

      {session.status === "ended" && (
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link href={`/courses/${course.id}`} className="pill-ghost">
            ← Back to {course.name}
          </Link>
          <Link href={`/sessions/new?course=${course.id}`} className="pill-coral">
            + Plan the next lecture
          </Link>
        </div>
      )}
    </div>
  );
}
