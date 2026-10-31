import { describe, expect, it } from "vitest";
import { cosine, formatOffset, keywordLabel, keywords, median, shortLabel, stripPersonalDetails, trendingWords } from "../src";

describe("text helpers", () => {
  it("keeps topic words and drops filler", () => {
    expect(keywords("What's the difference between a TLB and page tables?")).toEqual(["tlb", "page", "table"]);
  });

  it("names a group of similar questions by what they share", () => {
    const label = keywordLabel(["What's the TLB vs the page table?", "TLB vs page table difference", "is the TLB a cache for the page table"]);
    expect(label).toBe("TLB · page table");
  });

  it("falls back to the first words when nothing is shared", () => {
    expect(keywordLabel(["Will paging be on the midterm?"])).toBe("Will paging be on the midterm");
    expect(shortLabel("a ".repeat(40))).toMatch(/…$/);
  });

  it("finds trending words that appear in more than one question", () => {
    const words = trendingWords(["TLB miss?", "what is a TLB", "page fault"]).map((w) => w.word);
    expect(words).toEqual(["TLB"]);
  });

  it("removes personal details before text leaves the server", () => {
    const s = stripPersonalDetails("mail me at sam@uni.edu or +44 7700 900123, see https://x.io @sam");
    expect(s).not.toMatch(/sam@uni|7700|https|@sam/);
  });

  it("does the maths right", () => {
    expect(cosine([1, 0], [1, 0])).toBe(1);
    expect(cosine([1, 0], [0, 1])).toBe(0);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(formatOffset(125_000)).toBe("2:05");
  });
});
