import { describe, expect, it } from "vitest";
import { csvCell, fileSlug } from "@/lib/csv";

describe("CSV export", () => {
  it("quotes commas, quotes and new lines", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(42)).toBe("42");
  });

  it("stops student text from running as a spreadsheet formula", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-1+2")).toBe("'-1+2");
    expect(csvCell(-3)).toBe("-3");
  });

  it("makes safe file names", () => {
    expect(fileSlug("CS 310 · Operating Systems")).toBe("CS-310-Operating-Systems");
    expect(fileSlug("···")).toBe("handsup");
  });
});
