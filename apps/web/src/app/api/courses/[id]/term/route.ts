import type { NextRequest } from "next/server";
import { csvResponse, fileSlug } from "@/lib/csv";
import { requireCourse } from "@/lib/teacher";
import { termCsvRows, termLectures, termPdf } from "@/lib/term-report";

/** The whole course in one file: GET /api/courses/:id/term?format=pdf|csv */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { course } = await requireCourse((await ctx.params).id);
  const lectures = await termLectures(course.id);
  const name = `${fileSlug(course.name)}-term-report`;
  if (req.nextUrl.searchParams.get("format") === "csv") return csvResponse(termCsvRows(lectures), `${name}.csv`);
  const pdf = await termPdf(course, lectures);
  return new Response(Buffer.from(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${name}.pdf"`, "cache-control": "no-store" },
  });
}
