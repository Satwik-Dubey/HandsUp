import "server-only";
import { formatOffset, type ReportView, type SegmentView } from "@handsup/shared";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { TimelinePoint } from "@/stores/live";

const A4 = { w: 595.28, h: 841.89 };
const M = 48;
const INK = rgb(0.07, 0.07, 0.07);
const MUTED = rgb(0.45, 0.45, 0.45);
const CORAL = rgb(0.937, 0.388, 0.29);
const LINE = rgb(0.88, 0.87, 0.84);

/** The report as a printable A4 PDF (built-in fonts, no files needed). */
export async function reportPdf(report: ReportView, series: TimelinePoint[], segments: SegmentView[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Session recap · ${report.title}`);
  doc.setCreator("HandsUp");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Standard fonts only know Latin characters: drop anything else (emoji etc.).
  const ok = new Map<string, boolean>();
  const safe = (t: string) =>
    [...t]
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
  const newPageIfNeeded = (h: number) => {
    if (y - h < M) {
      page = doc.addPage([A4.w, A4.h]);
      y = A4.h - M;
    }
  };
  const text = (t: string, x: number, size: number, font: PDFFont = regular, color = INK) => page.drawText(safe(t), { x, y, size, font, color });
  const wrap = (t: string, size: number, width: number, font: PDFFont = regular) => {
    const lines: string[] = [];
    for (const para of safe(t).split(/\n+/)) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > width && line) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      if (line) lines.push(line);
    }
    return lines;
  };
  const paragraph = (t: string, size = 11, font: PDFFont = regular, color = INK, indent = 0) => {
    for (const l of wrap(t, size, A4.w - 2 * M - indent, font)) {
      newPageIfNeeded(size + 4);
      text(l, M + indent, size, font, color);
      y -= size + 4;
    }
  };
  const heading = (t: string) => {
    newPageIfNeeded(40);
    y -= 14;
    text(t, M, 14, bold);
    y -= 20;
  };

  // Title
  text("HANDSUP · SESSION RECAP", M, 9, bold, CORAL);
  y -= 26;
  paragraph(report.title, 22, bold);
  const when = report.startedAt ? new Date(report.startedAt).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" }) : "";
  paragraph([report.courseName, when].filter(Boolean).join(" · "), 11, regular, MUTED);
  y -= 6;

  // Stats
  const st = report.stats;
  if (st) {
    const cells: [string, string][] = [
      ["Peak audience", String(st.peakAudience)],
      ["Avg engaged", st.avgEngaged === null ? "-" : `${Math.round(st.avgEngaged * 100)}%`],
      ["Understanding", st.avgUnderstanding === null ? "-" : String(st.avgUnderstanding)],
      ["Questions", String(st.questions)],
      ["Clarity", st.clarity === null ? "-" : `${st.clarity.toFixed(1)}/5`],
      ["Duration", `${st.durationMin} min`],
    ];
    const cw = (A4.w - 2 * M) / cells.length;
    newPageIfNeeded(50);
    cells.forEach(([label, value], i) => {
      page.drawText(value, { x: M + i * cw, y: y - 18, size: 20, font: bold, color: INK });
      page.drawText(label, { x: M + i * cw, y: y - 32, size: 8, font: regular, color: MUTED });
    });
    y -= 48;
  }

  heading("Summary");
  paragraph(report.summaryMd ?? "");

  // Chart
  const pts = series.filter((p) => p.understanding !== null);
  if (pts.length > 1) {
    heading("Understanding across the lecture");
    const h = 130;
    newPageIfNeeded(h + 20);
    const x0 = M + 20;
    const w = A4.w - 2 * M - 20;
    const top = y;
    const t0 = report.startedAt ?? series[0]!.bucket;
    const t1 = Math.max(series[series.length - 1]!.bucket + 60_000, t0 + 60_000);
    const px = (t: number) => x0 + ((t - t0) / (t1 - t0)) * w;
    const py = (v: number) => top - h + (v / 100) * h;
    for (const v of [0, 50, 100]) {
      page.drawLine({ start: { x: x0, y: py(v) }, end: { x: x0 + w, y: py(v) }, thickness: 0.5, color: LINE });
      page.drawText(String(v), { x: M, y: py(v) - 3, size: 7, font: regular, color: MUTED });
    }
    for (const s of segments) {
      if (s.startsAt < t0 || s.startsAt > t1) continue;
      page.drawLine({ start: { x: px(s.startsAt), y: top - h }, end: { x: px(s.startsAt), y: top + 4 }, thickness: 0.5, color: MUTED, dashArray: [2, 2] });
      page.drawText(safe(s.label).slice(0, 14), { x: px(s.startsAt) + 2, y: top + 2, size: 6.5, font: regular, color: MUTED });
    }
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      page.drawLine({
        start: { x: px(a.bucket + 30_000), y: py(a.understanding!) },
        end: { x: px(b.bucket + 30_000), y: py(b.understanding!) },
        thickness: 2,
        color: CORAL,
      });
    }
    page.drawText("0:00", { x: x0, y: top - h - 11, size: 7, font: regular, color: MUTED });
    const endLabel = formatOffset(t1 - t0);
    page.drawText(endLabel, { x: x0 + w - regular.widthOfTextAtSize(endLabel, 7), y: top - h - 11, size: 7, font: regular, color: MUTED });
    y = top - h - 24;
  }

  if (report.keyMoments.length) {
    heading("Key moments");
    for (const m of report.keyMoments) {
      newPageIfNeeded(30);
      text(formatOffset(m.offsetMs), M, 10, bold);
      paragraph(m.title, 10, bold, INK, 44);
      paragraph(m.detail, 10, regular, MUTED, 44);
      y -= 3;
    }
  }

  if (report.topQuestions.length) {
    heading("Most asked");
    report.topQuestions.forEach((q, i) => {
      paragraph(`${i + 1}. ${q.label} (${q.people} ${q.people === 1 ? "student" : "students"})`, 10, bold);
      if (q.size > 1) paragraph(`e.g. "${q.sample}"`, 9, regular, MUTED, 14);
    });
  }

  if (report.segments.length) {
    heading("Slide by slide");
    const cols = [0, 170, 230, 330, 420];
    const row = (cells: string[], font: PDFFont, color = INK) => {
      newPageIfNeeded(16);
      cells.forEach((c, i) => page.drawText(safe(c).slice(0, 30), { x: M + cols[i]!, y, size: 9, font, color }));
      y -= 15;
    };
    row(["Slide", "Starts", "Understanding", "Confused peak", "Questions"], regular, MUTED);
    for (const s of report.segments)
      row(
        [
          s.label,
          formatOffset(s.startsAtMs),
          s.avgUnderstanding === null ? "-" : String(s.avgUnderstanding),
          `${Math.round(s.confusedPeak * 100)}%`,
          String(s.questions),
        ],
        regular,
      );
  }

  // Footer on every page
  const pages = doc.getPages();
  pages.forEach((p, i) =>
    p.drawText(`HandsUp · ${safe(report.title)} · page ${i + 1} of ${pages.length}`, { x: M, y: 24, size: 7, font: regular, color: MUTED }),
  );
  return doc.save();
}
