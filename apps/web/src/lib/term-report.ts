import "server-only";
import { and, asc, eq, reports, sessions, sql } from "@handsup/db";
import type { ReportStats, TopQuestionGroup } from "@handsup/shared";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { db } from "@/lib/db";
import { firstSentences, summarizeTerm, type TermLecture, type TermSummary } from "@/lib/term";

const A4 = { w: 595.28, h: 841.89 };
const M = 48;
const INK = rgb(0.07, 0.07, 0.07);
const MUTED = rgb(0.42, 0.4, 0.37);
const CORAL = rgb(0.8, 0.29, 0.19);
const SUN = rgb(0.95, 0.79, 0.3);
const LINE = rgb(0.88, 0.87, 0.84);

/** Every ended lecture of a course that has a report, oldest first. */
export async function termLectures(courseId: string): Promise<TermLecture[]> {
  const rows = await db
    .select({
      id: sessions.id,
      title: sessions.title,
      startedAt: sessions.startedAt,
      createdAt: sessions.createdAt,
      stats: reports.stats,
      summary: reports.summaryMd,
      topQuestions: reports.topQuestions,
    })
    .from(sessions)
    .innerJoin(reports, eq(reports.sessionId, sessions.id))
    .where(and(eq(sessions.courseId, courseId), eq(sessions.status, "ended")))
    .orderBy(asc(sql`coalesce(${sessions.startedAt}, ${sessions.createdAt})`));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    date: (r.startedAt ?? r.createdAt).getTime(),
    stats: (r.stats as ReportStats | null) ?? null,
    summary: r.summary,
    topQuestions: (r.topQuestions as TopQuestionGroup[] | null) ?? [],
  }));
}

const day = (t: number) => new Date(t).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });

/** One CSV row per lecture with its numbers and the most asked topic. */
export function termCsvRows(lectures: TermLecture[]): (string | number | null)[][] {
  return [
    ["date", "lecture", "peak_audience", "joined", "minutes", "avg_understanding", "avg_engaged", "clarity", "questions", "answered", "polls", "most_asked"],
    ...lectures.map((l) => [
      new Date(l.date).toISOString().slice(0, 10),
      l.title,
      l.stats?.peakAudience ?? null,
      l.stats?.joined ?? null,
      l.stats?.durationMin ?? null,
      l.stats?.avgUnderstanding ?? null,
      l.stats?.avgEngaged === null || l.stats?.avgEngaged === undefined ? null : l.stats.avgEngaged.toFixed(3),
      l.stats?.clarity === null || l.stats?.clarity === undefined ? null : l.stats.clarity.toFixed(1),
      l.stats?.questions ?? null,
      l.stats?.answered ?? null,
      l.stats?.polls ?? null,
      l.topQuestions[0]?.label ?? null,
    ]),
  ];
}

/** The term report as an A4 PDF: totals, a lecture-by-lecture chart, highlights, top topics and short summaries. */
export async function termPdf(course: { name: string; term: string | null }, lectures: TermLecture[]): Promise<Uint8Array> {
  const t: TermSummary = summarizeTerm(lectures);
  const ordered = [...lectures].sort((a, b) => a.date - b.date);
  const doc = await PDFDocument.create();
  doc.setTitle(`Term report · ${course.name}`);
  doc.setCreator("HandsUp");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Standard fonts only cover Latin text: drop anything else (emoji etc.).
  const ok = new Map<string, boolean>();
  const safe = (s: string) =>
    [...s]
      .filter((ch) => {
        if (!ok.has(ch)) {
          try {
            regular.encodeText(ch);
            ok.set(ch, true);
          } catch {
            ok.set(ch, false);
          }
        }
        return ok.get(ch);
      })
      .join("");

  let page: PDFPage = doc.addPage([A4.w, A4.h]);
  let y = A4.h - M;
  const room = (h: number) => {
    if (y - h < M) {
      page = doc.addPage([A4.w, A4.h]);
      y = A4.h - M;
    }
  };
  const text = (s: string, x: number, size: number, font: PDFFont = regular, color = INK) => page.drawText(safe(s), { x, y, size, font, color });
  const paragraph = (s: string, size = 10.5, font: PDFFont = regular, color = INK, indent = 0) => {
    const width = A4.w - 2 * M - indent;
    for (const para of safe(s).split(/\n+/)) {
      let line = "";
      const flush = () => {
        room(size + 4);
        text(line, M + indent, size, font, color);
        y -= size + 4;
      };
      for (const word of para.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > width && line) {
          flush();
          line = word;
        } else line = next;
      }
      if (line) flush();
    }
  };
  const heading = (s: string) => {
    room(44);
    y -= 14;
    text(s, M, 14, bold);
    y -= 20;
  };

  // Title
  text("HANDSUP · TERM REPORT", M, 9, bold, CORAL);
  y -= 26;
  paragraph(course.name, 22, bold);
  paragraph(
    [course.term, t.first && t.last ? `${day(t.first)} to ${day(t.last)}` : null, `${t.lectures} ${t.lectures === 1 ? "lecture" : "lectures"}`].filter(Boolean).join(" · "),
    11,
    regular,
    MUTED,
  );
  y -= 6;

  if (!t.lectures) {
    paragraph("No ended lectures with a report yet. Run a lecture, end it, and the term report fills in.", 11);
    return doc.save();
  }

  // Totals
  const cells: [string, string][] = [
    ["Avg understanding", t.avgUnderstanding === null ? "-" : String(t.avgUnderstanding)],
    ["Avg engaged", t.avgEngaged === null ? "-" : `${Math.round(t.avgEngaged * 100)}%`],
    ["Avg clarity", t.avgClarity === null ? "-" : `${t.avgClarity.toFixed(1)}/5`],
    ["Avg students", t.avgPeakAudience === null ? "-" : String(t.avgPeakAudience)],
    ["Questions", `${t.questions}`],
    ["Answered", t.questions ? `${Math.round((t.answered / t.questions) * 100)}%` : "-"],
  ];
  const cw = (A4.w - 2 * M) / cells.length;
  room(50);
  cells.forEach(([label, value], i) => {
    page.drawText(value, { x: M + i * cw, y: y - 18, size: 19, font: bold, color: INK });
    page.drawText(label, { x: M + i * cw, y: y - 32, size: 8, font: regular, color: MUTED });
  });
  y -= 48;

  // Understanding per lecture (bars; the hardest one in coral)
  const scored = ordered.filter((l) => l.stats?.avgUnderstanding !== null && l.stats?.avgUnderstanding !== undefined);
  if (scored.length) {
    heading("Understanding, lecture by lecture");
    const h = 120;
    room(h + 30);
    const top = y;
    const x0 = M + 20;
    const w = A4.w - 2 * M - 20;
    const slot = w / scored.length;
    const bw = Math.min(36, slot * 0.7);
    for (const v of [0, 50, 100]) {
      const yy = top - h + (v / 100) * h;
      page.drawLine({ start: { x: x0, y: yy }, end: { x: x0 + w, y: yy }, thickness: 0.5, color: LINE });
      page.drawText(String(v), { x: M, y: yy - 3, size: 7, font: regular, color: MUTED });
    }
    scored.forEach((l, i) => {
      const v = l.stats!.avgUnderstanding!;
      const x = x0 + i * slot + (slot - bw) / 2;
      page.drawRectangle({ x, y: top - h, width: bw, height: Math.max(1, (v / 100) * h), color: l.id === t.hardest?.id ? CORAL : SUN });
      page.drawText(String(v), { x: x + bw / 2 - bold.widthOfTextAtSize(String(v), 7) / 2, y: top - h + (v / 100) * h + 3, size: 7, font: bold, color: INK });
      const label = `L${ordered.indexOf(l) + 1}`;
      page.drawText(label, { x: x + bw / 2 - regular.widthOfTextAtSize(label, 7) / 2, y: top - h - 11, size: 7, font: regular, color: MUTED });
    });
    y = top - h - 26;
  }

  // Highlights
  heading("Highlights");
  const lname = (l: TermLecture) => `L${ordered.indexOf(l) + 1} "${l.title}"`;
  const lines = [
    t.best && t.best.stats?.avgUnderstanding !== null ? `Clearest lecture: ${lname(t.best)} at ${t.best.stats!.avgUnderstanding}/100.` : null,
    t.hardest && t.hardest !== t.best ? `Hardest lecture: ${lname(t.hardest)} at ${t.hardest.stats!.avgUnderstanding}/100. Worth a recap.` : null,
    t.biggestDrop ? `Biggest drop: ${Math.round(t.biggestDrop.points)} points from ${lname(t.biggestDrop.from)} to ${lname(t.biggestDrop.to)}.` : null,
    t.mostQuestions && t.mostQuestions.stats!.questions > 0 ? `Most questions: ${lname(t.mostQuestions)} with ${t.mostQuestions.stats!.questions}.` : null,
  ].filter((x): x is string => Boolean(x));
  for (const l of lines.length ? lines : ["Not enough data yet for highlights."]) paragraph(`- ${l}`, 10.5);

  // Topics
  if (t.topics.length) {
    heading("What students asked about most");
    t.topics.forEach((q, i) => {
      paragraph(`${i + 1}. ${q.label} (${q.people} ${q.people === 1 ? "student" : "students"})`, 10.5, bold);
      paragraph(q.lectures.slice(0, 4).join(", ") + (q.lectures.length > 4 ? ", ..." : ""), 9, regular, MUTED, 14);
    });
  }

  // Lecture by lecture
  heading("Lecture by lecture");
  ordered.forEach((l, i) => {
    room(46);
    paragraph(`L${i + 1} · ${l.title}`, 11, bold);
    const st = l.stats;
    paragraph(
      [
        day(l.date),
        st ? `${st.peakAudience} students` : null,
        st?.avgUnderstanding !== null && st?.avgUnderstanding !== undefined ? `understanding ${st.avgUnderstanding}` : null,
        st?.avgEngaged !== null && st?.avgEngaged !== undefined ? `${Math.round(st.avgEngaged * 100)}% engaged` : null,
        st ? `${st.questions} questions` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      9,
      regular,
      MUTED,
    );
    const s = firstSentences(l.summary);
    if (s) paragraph(s, 9.5, regular, INK);
    y -= 6;
  });

  const pages = doc.getPages();
  pages.forEach((p, i) => p.drawText(`HandsUp · Term report · ${safe(course.name)} · page ${i + 1} of ${pages.length}`, { x: M, y: 24, size: 7, font: regular, color: MUTED }));
  return doc.save();
}
