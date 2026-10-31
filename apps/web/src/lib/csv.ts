/** One CSV cell: quoted when needed, and protected from spreadsheet formula injection by student text. */
export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  const safe = /^[=+\-@\t\r]/.test(s) && typeof v === "string" ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** A file-name-safe slug, e.g. for "CS 310 · OS" → "CS-310-OS". */
export function fileSlug(name: string, max = 50) {
  return name.replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, max) || "handsup";
}

/** A CSV download. The BOM makes Excel open UTF-8 correctly. */
export function csvResponse(rows: (string | number | null | undefined)[][], fileName: string) {
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  return new Response(`﻿${csv}`, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${fileName}"`, "cache-control": "no-store" },
  });
}
