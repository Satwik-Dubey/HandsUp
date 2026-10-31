import {
  LIMITS,
  REACTIONS,
  emptyCounts,
  rk,
  understandingScore,
  type ReactionCounts,
  type TickEvent,
} from "@handsup/shared";
import type { Redis } from "ioredis";

function addCounts(h: Record<string, string> | null | undefined, into: ReactionCounts): ReactionCounts {
  if (!h) return into;
  for (const r of REACTIONS) into[r] += Number(h[r] ?? 0);
  return into;
}

export async function activeCount(redis: Redis, sid: string, now = Date.now()): Promise<number> {
  return redis.zcount(rk.presence(sid), now - LIMITS.activeWindowMs, "+inf");
}

/**
 * Live numbers for one session, read only from Redis counters.
 * Used every second for the dashboard `tick`, and by the aggregator when it closes a 5-second window.
 */
export async function computeSnapshot(redis: Redis, sid: string, status: TickEvent["status"]): Promise<TickEvent> {
  const now = Date.now();
  const since = now - LIMITS.activeWindowMs;
  const sec = Math.floor(now / 1000);

  const p = redis.pipeline();
  p.zcount(rk.presence(sid), since, "+inf");
  p.scard(rk.joined(sid));
  p.zcount(rk.reactors(sid, "any"), since, "+inf");
  p.zcount(rk.reactors(sid, "confused"), since, "+inf");
  p.hgetall(rk.count(sid));
  p.hvals(rk.rating(sid));
  for (let i = 0; i < 60; i++) p.hgetall(rk.second(sid, sec - i));
  const res = (await p.exec()) ?? [];
  const val = <T>(i: number) => res[i]?.[1] as T;

  const active = val<number>(0) ?? 0;
  const joined = val<number>(1) ?? 0;
  const reactors = val<number>(2) ?? 0;
  const confusedReactors = val<number>(3) ?? 0;
  const totals = addCounts(val<Record<string, string>>(4), emptyCounts());
  const ratings = (val<string[]>(5) ?? []).map(Number).filter((n) => n >= 1 && n <= 5);
  const lastMinute = emptyCounts();
  for (let i = 0; i < 60; i++) addCounts(val<Record<string, string>>(6 + i), lastMinute);

  const reactionsPerMin = REACTIONS.reduce((n, r) => n + lastMinute[r], 0);
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const denom = Math.max(active, reactors, 1);

  return {
    t: now,
    status,
    active,
    joined,
    engaged: reactors / denom,
    reactionsPerMin,
    lastMinute,
    totals,
    confusedRatio: confusedReactors / denom,
    avgRating: avgRating === null ? null : Math.round(avgRating * 10) / 10,
    ratingCount: ratings.length,
    understanding: understandingScore({ lastMinute, reactors, active, avgRating, ratingCount: ratings.length }),
  };
}

/** Drops presence and "who reacted" entries older than 10 minutes so the sorted sets stay small. */
export async function trimSession(redis: Redis, sid: string) {
  const cutoff = Date.now() - 10 * 60_000;
  const p = redis.pipeline();
  p.zremrangebyscore(rk.presence(sid), "-inf", cutoff);
  for (const r of [...REACTIONS, "any"] as const) p.zremrangebyscore(rk.reactors(sid, r), "-inf", cutoff);
  await p.exec();
}
