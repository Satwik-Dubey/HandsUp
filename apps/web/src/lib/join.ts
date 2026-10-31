import "server-only";
import { courses, eq, sessions, teachers } from "@handsup/db";
import { DEFAULT_SETTINGS, LIMITS, isValidJoinCode, normalizeJoinCode, rk, type JoinInfo } from "@handsup/shared";
import { db } from "./db";
import { getRedis } from "./redis";

export type JoinLookup = { ok: true; info: JoinInfo } | { ok: false; error: "not_found" | "too_many_attempts" };

/**
 * Looks up a class code for the join screens. Wrong codes count against the caller's IP,
 * and after LIMITS.joinAttemptsPerMinute misses in a minute further lookups are refused.
 */
export async function lookupJoinCode(rawCode: string, ip: string): Promise<JoinLookup> {
  const code = normalizeJoinCode(rawCode);
  const redis = getRedis();
  const key = rk.joinAttempts(ip);
  if (Number((await redis.get(key)) ?? 0) >= LIMITS.joinAttemptsPerMinute) return { ok: false, error: "too_many_attempts" };

  const row = isValidJoinCode(code)
    ? (
        await db
          .select({
            code: sessions.joinCode,
            title: sessions.title,
            status: sessions.status,
            startsAt: sessions.startsAt,
            settings: sessions.settings,
            courseName: courses.name,
            teacherName: teachers.displayName,
            teacherFullName: teachers.name,
          })
          .from(sessions)
          .innerJoin(courses, eq(courses.id, sessions.courseId))
          .innerJoin(teachers, eq(teachers.id, courses.teacherId))
          .where(eq(sessions.joinCode, code))
          .limit(1)
      )[0]
    : undefined;

  if (!row) {
    await redis.multi().incr(key).expire(key, 60).exec();
    return { ok: false, error: "not_found" };
  }

  return {
    ok: true,
    info: {
      code: row.code,
      title: row.title,
      status: row.status,
      courseName: row.courseName,
      teacherName: row.teacherName ?? row.teacherFullName,
      startsAt: row.startsAt?.toISOString() ?? null,
      inputs: { ...DEFAULT_SETTINGS.inputs, ...(row.settings?.inputs ?? {}) },
    },
  };
}

export function ipFrom(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
}
