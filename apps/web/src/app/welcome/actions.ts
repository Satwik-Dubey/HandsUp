"use server";

import { courses, eq, polls, sessions, teachers } from "@handsup/db";
import { COURSE_COLORS, DEFAULT_SETTINGS, createCourseSchema, randomJoinCode } from "@handsup/shared";
import { z } from "zod";
import { db } from "@/lib/db";
import { publishControl } from "@/lib/redis";
import { requireCourse, requireTeacher } from "@/lib/teacher";

const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Add the name students should see").max(80),
  institution: z.string().trim().max(120),
});

export async function saveProfile(input: { displayName: string; institution: string }) {
  const t = await requireTeacher();
  const p = profileSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: p.error.issues[0]!.message };
  await db
    .update(teachers)
    .set({ displayName: p.data.displayName, institution: p.data.institution || null })
    .where(eq(teachers.id, t.id));
  return { ok: true as const };
}

export async function createFirstCourse(input: { name: string; term: string; color: string }) {
  const t = await requireTeacher();
  const p = createCourseSchema.safeParse({ ...input, color: COURSE_COLORS.includes(input.color as never) ? input.color : "coral" });
  if (!p.success) return { ok: false as const, error: p.error.issues[0]?.message ?? "Check the course name" };
  const [row] = await db.insert(courses).values({ teacherId: t.id, ...p.data }).returning({ id: courses.id });
  return { ok: true as const, courseId: row!.id };
}

/** "Try it on yourself": a live demo lecture with two polls, filled with demo students by the workers. */
export async function startDemoLecture(courseId: string) {
  await requireCourse(courseId);
  let id: string | null = null;
  for (let attempt = 0; attempt < 6 && !id; attempt++) {
    try {
      const [row] = await db
        .insert(sessions)
        .values({
          courseId,
          title: "Demo lecture · Paging",
          template: "lecture",
          joinCode: randomJoinCode(),
          settings: DEFAULT_SETTINGS,
          retentionDays: 7,
          status: "live",
          startedAt: new Date(),
        })
        .returning({ id: sessions.id, code: sessions.joinCode });
      id = row!.id;
      await db.insert(polls).values([
        { sessionId: id, position: 0, question: "Which policy evicts the page unused the longest?", kind: "single", options: ["LRU", "FIFO", "Clock", "Random"] },
        { sessionId: id, position: 1, question: "How clear was today's explanation?", kind: "rating", options: [] },
      ]);
      await publishControl({ type: "session:status", sessionId: id, status: "live" });
      await publishControl({ type: "demo:start", sessionId: id, code: row!.code, count: 25 });
    } catch (e) {
      if ((e as { code?: string }).code !== "23505") throw e; // retry only on a join code collision
    }
  }
  await finishSetup();
  return id;
}

export async function finishSetup() {
  const t = await requireTeacher();
  if (!t.onboardedAt) await db.update(teachers).set({ onboardedAt: new Date() }).where(eq(teachers.id, t.id));
}
