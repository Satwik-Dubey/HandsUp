import { eq, reports, sessions } from "@handsup/db";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/PublicHeader";
import { ReportBody } from "@/components/report/ReportBody";
import { db } from "@/lib/db";
import { minuteSeries, reportView, sessionSegments } from "@/lib/report";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Session recap", robots: { index: false } };

/** Read-only report for anyone with the link (the teacher turns it on with "Share link"). */
export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{10,40}$/.test(token)) notFound();
  const r = await db.query.reports.findFirst({ where: eq(reports.shareToken, token), columns: { sessionId: true } });
  if (!r) notFound();
  const [report, series, segments, s] = await Promise.all([
    reportView(r.sessionId),
    minuteSeries(r.sessionId),
    sessionSegments(r.sessionId),
    db.query.sessions.findFirst({ where: eq(sessions.id, r.sessionId), columns: { startedAt: true } }),
  ]);
  if (!report) notFound();

  return (
    <>
      <PublicHeader />
      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-4 sm:px-6">
        <div>
          <p className="text-muted">{report.courseName}</p>
          <h1 className="poster text-5xl sm:text-6xl">Session recap</h1>
          <p className="text-lg text-text2">
            {report.title}
            {s?.startedAt ? ` · ${formatDate(s.startedAt)}` : ""}
          </p>
        </div>
        <ReportBody report={report} series={series} segments={segments} past={[]} linkPast={false} />
      </main>
    </>
  );
}
