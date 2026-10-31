import { minuteSeries, reportView, sessionSegments } from "@/lib/report";
import { reportPdf } from "@/lib/report-pdf";
import { requireOwnedSession } from "@/lib/teacher";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { session } = await requireOwnedSession((await ctx.params).id);
  const [report, series, segments] = await Promise.all([reportView(session.id), minuteSeries(session.id), sessionSegments(session.id)]);
  if (!report?.generatedAt) return new Response("The report isn't ready yet.", { status: 409 });
  const pdf = await reportPdf(report, series, segments);
  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${fileName(session.title)}-recap.pdf"`,
      "cache-control": "no-store",
    },
  });
}

function fileName(title: string) {
  return title.replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "lecture";
}
