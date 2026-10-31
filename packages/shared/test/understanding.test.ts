import { describe, expect, it } from "vitest";
import { understandingScore } from "../src";

const taps = (p: Partial<Record<"gotIt" | "confused" | "tooFast" | "tooSlow" | "example", number>>) => ({ gotIt: 0, confused: 0, tooFast: 0, tooSlow: 0, example: 0, ...p });

describe("understanding score", () => {
  it("is null with no signal at all", () => {
    expect(understandingScore({ lastMinute: taps({}), reactors: 0, active: 30, avgRating: null, ratingCount: 0 })).toBeNull();
  });

  it("is high when everyone has got it", () => {
    expect(understandingScore({ lastMinute: taps({ gotIt: 30 }), reactors: 30, active: 30, avgRating: null, ratingCount: 0 })).toBe(100);
  });

  it("is low when the class is confused", () => {
    const s = understandingScore({ lastMinute: taps({ confused: 25, gotIt: 2 }), reactors: 27, active: 30, avgRating: null, ratingCount: 0 })!;
    expect(s).toBeLessThan(20);
  });

  it("does not let one tap swing a big class", () => {
    const s = understandingScore({ lastMinute: taps({ confused: 1 }), reactors: 1, active: 200, avgRating: null, ratingCount: 0 })!;
    expect(s).toBeGreaterThan(60);
  });

  it("blends in the clarity rating and stays within 0 to 100", () => {
    const s = understandingScore({ lastMinute: taps({ gotIt: 10 }), reactors: 10, active: 20, avgRating: 1, ratingCount: 10 })!;
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThan(100);
  });
});
