import "server-only";
import { and, courses, eq, sessions } from "@handsup/db";
import { notFound, redirect } from "next/navigation";
import { currentTeacher } from "@/auth";
import { db } from "./db";

export async function requireTeacher() {
  const t = await currentTeacher();
  if (!t) redirect("/login");
  return t;
}

export async function requireCourse(courseId: string) {
  const t = await requireTeacher();
  if (!/^[0-9a-f-]{36}$/i.test(courseId)) notFound();
  const course = await db.query.courses.findFirst({ where: and(eq(courses.id, courseId), eq(courses.teacherId, t.id)) });
  if (!course) notFound();
  return { teacher: t, course };
}

/** Loads a session only if the signed-in teacher owns it. */
export async function requireOwnedSession(sessionId: string) {
  const t = await requireTeacher();
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) notFound();
  const rows = await db
    .select({ session: sessions, course: courses })
    .from(sessions)
    .innerJoin(courses, eq(courses.id, sessions.courseId))
    .where(and(eq(sessions.id, sessionId), eq(courses.teacherId, t.id)))
    .limit(1);
  if (!rows[0]) notFound();
  return { teacher: t, ...rows[0] };
}
