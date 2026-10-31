import { describe, expect, it } from "vitest";
import { createCourseSchema, createPollSchema } from "../src";

describe("form validation", () => {
  it("needs a course name of at least 2 characters", () => {
    expect(createCourseSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(createCourseSchema.safeParse({ name: "CS 310" }).success).toBe(true);
  });

  it("needs at least two options for a multiple choice poll", () => {
    const base = { sessionId: "6f1c1d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f", question: "Which policy?", kind: "single" };
    expect(createPollSchema.safeParse({ ...base, options: ["LRU"] }).success).toBe(false);
    expect(createPollSchema.safeParse({ ...base, options: ["LRU", "FIFO"] }).success).toBe(true);
  });
});
