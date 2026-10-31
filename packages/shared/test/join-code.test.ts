import { describe, expect, it } from "vitest";
import { JOIN_CODE_ALPHABET, isValidJoinCode, normalizeJoinCode, randomJoinCode } from "../src";

describe("join codes", () => {
  it("are 6 characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = randomJoinCode();
      expect(code).toHaveLength(6);
      expect(isValidJoinCode(code)).toBe(true);
    }
  });

  it("never use look-alike characters", () => {
    for (const ch of "O0I1L") expect(JOIN_CODE_ALPHABET).not.toContain(ch);
  });

  it("normalize what people type", () => {
    expect(normalizeJoinCode(" k7q-2mx ")).toBe("K7Q2MX");
    expect(normalizeJoinCode("abcdefgh")).toBe("ABCDEF");
  });

  it("reject wrong length or characters", () => {
    expect(isValidJoinCode("ABC")).toBe(false);
    expect(isValidJoinCode("ABCDE0")).toBe(false);
    expect(isValidJoinCode("AXTST2")).toBe(true);
  });
});
