import type { ReactionCounts } from "./events";

/**
 * Understanding score (0–100).
 *
 * Blends the last minute of taps with the class's clarity ratings:
 *  - "Got it" pulls up; "Confused" pulls down hardest; pace and "example please" pull down a little.
 *  - The 1–5 clarity rating maps to 0–100.
 *  - With only a few students reacting, the score leans toward a neutral 70 so one tap can't swing it.
 * Returns null when there is no signal at all yet.
 */
export function understandingScore(input: {
  lastMinute: ReactionCounts;
  /** Distinct students who tapped anything in the last minute. */
  reactors: number;
  active: number;
  avgRating: number | null;
  ratingCount: number;
}): number | null {
  const { lastMinute: c, reactors, active, avgRating, ratingCount } = input;
  const taps = c.gotIt + c.confused + c.tooFast + c.tooSlow + c.example;
  if (taps === 0 && (avgRating === null || ratingCount === 0)) return null;

  const NEUTRAL = 70;
  let tapScore: number | null = null;
  if (taps > 0) {
    const weighted = c.gotIt * 1 - c.confused * 1.5 - (c.tooFast + c.tooSlow) * 0.5 - c.example * 0.4;
    // weighted / taps is in [-1.5, 1]; map to 0–100 with 0 → 60.
    const ratio = weighted / taps;
    tapScore = ratio >= 0 ? 60 + ratio * 40 : 60 + (ratio / 1.5) * 60;
  }
  const ratingScore = avgRating !== null && ratingCount > 0 ? ((avgRating - 1) / 4) * 100 : null;

  let raw: number;
  if (tapScore !== null && ratingScore !== null) raw = 0.65 * tapScore + 0.35 * ratingScore;
  else raw = (tapScore ?? ratingScore)!;

  // Confidence grows with how many students are giving signal.
  const voices = Math.max(reactors, ratingCount);
  const needed = Math.max(3, Math.ceil(active * 0.15));
  const confidence = Math.min(1, voices / needed);
  const score = confidence * raw + (1 - confidence) * NEUTRAL;
  return Math.round(Math.max(0, Math.min(100, score)));
}
