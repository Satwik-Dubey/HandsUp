import "server-only";
import { and, asc, courses, desc, eq, metrics5s, ne, reports, segments, sessions, sql } from "@handsup/db";
import type { KeyMoment, ReportStats, ReportView, SegmentSummary, SegmentView, TopQuestionGroup } from "@handsup/shared";
import type { TimelinePoint } from "@/stores/live";
import { db } from "./db";

/** The lecture's timeline averaged per minute (the report chart and the CSV). */
export async function minuteSeries(sessionId: string): Promise<TimelinePoint[]> {
  const minute = sql`date_trunc('minute', ${metrics5s.bucket})`;
  return db
    .select({
      bucket: sql<number>`(extract(epoch from ${minute}) * 1000)::bigint`.mapWith(Number),
      active: sql<number>`max(${metrics5s.active})`.mapWith(Number),
      understanding: sql<number | null>`avg(${metrics5s.understanding})`.mapWith((v) => (v === null ? null : Number(v))),
      confusedRatio: sql<number>`avg(${metrics5s.confusedRatio})`.mapWith(Number),
      engaged: sql<number>`avg(${metrics5s.engaged})`.mapWith(Number),
      segmentId: sql<string | null>`(array_agg(${metrics5s.segmentId}::text order by ${metrics5s.bucket} desc))[1]`,
    })
    .from(metrics5s)
    .where(eq(metrics5s.sessionId, sessionId))
    .groupBy(minute)
    .orderBy(minute);
}

export async function sessionSegments(sessionId: string): Promise<SegmentView[]> {
  const rows = await db
    .select({ id: segments.id, label: segments.label, startsAt: segments.startsAt })
    .from(segments)
    .where(eq(segments.sessionId, sessionId))
    .orderBy(asc(segments.startsAt));
  return rows.map((s) => ({ ...s, startsAt: s.startsAt.getTime() }));
}

export async function reportView(sessionId: string): Promise<ReportView | null> {
  const [row] = await db
    .select({ s: sessions, courseName: courses.name, r: reports })
    .from(sessions)
    .innerJoin(courses, eq(courses.id, sessions.courseId))
    .leftJoin(reports, eq(reports.sessionId, sessions.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!row) return null;
  const { s, r } = row;
  return {
    sessionId: s.id,
    title: s.title,
    courseName: row.courseName,
    startedAt: s.startedAt?.getTime() ?? null,
    endedAt: s.endedAt?.getTime() ?? null,
    summaryMd: r?.summaryMd ?? null,
    summarySource: (r?.summarySource as ReportView["summarySource"]) ?? null,
    stats: (r?.stats as ReportStats | null) ?? null,
    keyMoments: (r?.keyMoments as KeyMoment[] | null) ?? [],
    topQuestions: (r?.topQuestions as TopQuestionGroup[] | null) ?? [],
    segments: (r?.segments as SegmentSummary[] | null) ?? [],
    generatedAt: r?.generatedAt?.getTime() ?? null,
  };
}

export interface PastLecture {
  id: string;
  title: string;
  date: number;
  stats: ReportStats | null;
}

/** Other ended lectures in the same course, newest first, for "This course so far" and the course comparison. */
export async function courseLectures(courseId: string, exceptId?: string): Promise<PastLecture[]> {
  const rows = await db
    .select({ id: sessions.id, title: sessions.title, startedAt: sessions.startedAt, createdAt: sessions.createdAt, stats: reports.stats })
    .from(sessions)
    .leftJoin(reports, eq(reports.sessionId, sessions.id))
    .where(and(eq(sessions.courseId, courseId), eq(sessions.status, "ended"), exceptId ? ne(sessions.id, exceptId) : undefined))
    .orderBy(desc(sql`coalesce(${sessions.startedAt}, ${sessions.createdAt})`))
    .limit(30);
  return rows.map((r) => ({ id: r.id, title: r.title, date: (r.startedAt ?? r.createdAt).getTime(), stats: (r.stats as ReportStats | null) ?? null }));
}
