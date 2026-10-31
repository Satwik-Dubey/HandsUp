"use server";

import { randomBytes } from "node:crypto";
import { and, clusters, count, courses, eq, events, insights, isNull, polls, questions, reports, sessions, students } from "@handsup/db";
import {
  COURSE_COLORS,
  DEFAULT_SETTINGS,
  LIMITS,
  RETENTION_CHOICES,
  SESSION_TEMPLATES,
  createCourseSchema,
  createPollSchema,
  createSessionSchema,
  randomJoinCode,
  type SessionInputs,
} from "@handsup/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { publishControl } from "@/lib/redis";
import { requireCourse, requireOwnedSession, requireTeacher } from "@/lib/teacher";

export type FormState = { error?: string } | undefined;

export async function createCourse(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = await requireTeacher();
  const parsed = createCourseSchema.safeParse({
    name: fd.get("name"),
    term: fd.get("term") ?? "",
    color: COURSE_COLORS.includes(fd.get("color") as never) ? fd.get("color") : "coral",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const [row] = await db
    .insert(courses)
    .values({ teacherId: t.id, ...parsed.data })
    .returning({ id: courses.id });
  revalidatePath("/courses");
  redirect(`/courses/${row!.id}`);
}

const INPUT_KEYS: (keyof SessionInputs)[] = ["react", "confused", "rating", "questions", "pollResults"];

export async function createSession(_prev: FormState, fd: FormData): Promise<FormState> {
  const courseId = String(fd.get("courseId") ?? "");
  await requireCourse(courseId);

  const inputs = Object.fromEntries(INPUT_KEYS.map((k) => [k, fd.get(`input_${k}`) === "on"])) as SessionInputs;
  const startsLocal = String(fd.get("startsAt") ?? "");
  const tz = Number(fd.get("tzOffset") ?? 0);
  // <input type="datetime-local"> has no zone; the form sends the browser's offset so the time is stored correctly.
  const startsAt = startsLocal ? new Date(new Date(`${startsLocal}:00Z`).getTime() + tz * 60_000).toISOString() : null;

  const parsed = createSessionSchema.safeParse({
    courseId,
    title: fd.get("title"),
    template: SESSION_TEMPLATES.includes(fd.get("template") as never) ? fd.get("template") : "lecture",
    startsAt,
    retentionDays: RETENTION_CHOICES.includes(Number(fd.get("retentionDays")) as never) ? Number(fd.get("retentionDays")) : 30,
    settings: { ...DEFAULT_SETTINGS, inputs, reviewQuestionsFirst: fd.get("reviewQuestionsFirst") === "on" },
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };

  // Join codes are unique; retry on the rare collision.
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const [row] = await db
        .insert(sessions)
        .values({
          courseId,
          title: parsed.data.title,
          template: parsed.data.template,
          joinCode: randomJoinCode(),
          settings: parsed.data.settings,
          retentionDays: parsed.data.retentionDays,
          startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
        })
        .returning({ id: sessions.id });
      revalidatePath(`/courses/${courseId}`);
      redirect(`/sessions/${row!.id}`);
    } catch (e) {
      if ((e as { code?: string }).code === "23505") continue; // unique violation on join_code
      throw e;
    }
  }
  return { error: "Couldn't create a join code. Try again." };
}

export async function startSession(sessionId: string) {
  const { session } = await requireOwnedSession(sessionId);
  if (session.status === "ended") return;
  await db
    .update(sessions)
    .set({ status: "live", startedAt: session.startedAt ?? new Date() })
    .where(and(eq(sessions.id, sessionId)));
  await publishControl({ type: "session:status", sessionId, status: "live" });
  revalidatePath(`/sessions/${sessionId}`);
}

export async function endSession(sessionId: string) {
  const { session, course } = await requireOwnedSession(sessionId);
  if (session.status === "ended") return;
  await db.update(sessions).set({ status: "ended", endedAt: new Date() }).where(eq(sessions.id, sessionId));
  await publishControl({ type: "session:status", sessionId, status: "ended" });
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/courses/${course.id}`);
}

// ---------- rename and delete ----------

export type ManageResult = { ok: true } | { ok: false; error: string };

export async function renameCourse(courseId: string, name: string, term: string): Promise<ManageResult> {
  await requireCourse(courseId);
  const parsed = createCourseSchema.pick({ name: true, term: true }).safeParse({ name, term });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the name" };
  await db.update(courses).set(parsed.data).where(eq(courses.id, courseId));
  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);
  return { ok: true };
}

/** Deletes a course with all its lectures and their data. Refused while one of them is live. */
export async function deleteCourse(courseId: string): Promise<ManageResult> {
  await requireCourse(courseId);
  const [live] = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.courseId, courseId), eq(sessions.status, "live"))).limit(1);
  if (live) return { ok: false, error: "A lecture in this course is live. End it first." };
  await db.delete(courses).where(eq(courses.id, courseId)); // lectures and everything in them cascade
  revalidatePath("/courses");
  return { ok: true };
}

export async function renameSession(sessionId: string, title: string): Promise<ManageResult> {
  const { course } = await requireOwnedSession(sessionId);
  const parsed = createSessionSchema.shape.title.safeParse(title);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the title" };
  await db.update(sessions).set({ title: parsed.data }).where(eq(sessions.id, sessionId));
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/courses/${course.id}`);
  return { ok: true };
}

/** Deletes a lecture, its report and everything students sent. Refused while it is live. */
export async function deleteSession(sessionId: string): Promise<ManageResult> {
  const { session, course } = await requireOwnedSession(sessionId);
  if (session.status === "live") return { ok: false, error: "This lecture is live. End it first." };
  await db.delete(sessions).where(eq(sessions.id, sessionId));
  revalidatePath(`/courses/${course.id}`);
  return { ok: true };
}

// ---------- polls (prepared before class, launched from the live dashboard) ----------

/** Copies the polls of another lecture in the same course onto the end of this one's list. */
export async function copyPolls(sessionId: string, fromSessionId: string): Promise<ManageResult & { copied?: number }> {
  const { session, course } = await requireOwnedSession(sessionId);
  const { course: fromCourse } = await requireOwnedSession(fromSessionId);
  if (fromCourse.id !== course.id) return { ok: false, error: "Pick a lecture from this course." };
  if (session.status === "ended") return { ok: false, error: "This lecture has ended." };
  const source = await db.query.polls.findMany({ where: eq(polls.sessionId, fromSessionId), orderBy: (p, { asc }) => [asc(p.position), asc(p.createdAt)] });
  if (!source.length) return { ok: false, error: "That lecture has no polls." };
  const [{ n }] = await db.select({ n: count() }).from(polls).where(eq(polls.sessionId, sessionId));
  await db.insert(polls).values(source.map((p, i) => ({ sessionId, question: p.question, kind: p.kind, options: p.options, position: n + i })));
  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true, copied: source.length };
}

export async function createPoll(_prev: FormState, fd: FormData): Promise<FormState & { ok?: boolean; pollId?: string }> {
  const sessionId = String(fd.get("sessionId") ?? "");
  await requireOwnedSession(sessionId);
  const kind = String(fd.get("kind") ?? "single");
  const parsed = createPollSchema.safeParse({
    sessionId,
    question: fd.get("question"),
    kind,
    options: kind === "rating" ? [] : fd.getAll("option").map(String).map((s) => s.trim()).filter(Boolean),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the poll" };
  const [{ n }] = await db.select({ n: count() }).from(polls).where(eq(polls.sessionId, sessionId));
  const [row] = await db
    .insert(polls)
    .values({ sessionId, question: parsed.data.question, kind: parsed.data.kind, options: parsed.data.options, position: n })
    .returning({ id: polls.id });
  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true, pollId: row!.id };
}

export async function deletePoll(sessionId: string, pollId: string) {
  await requireOwnedSession(sessionId);
  // Polls that already ran keep their votes for the report.
  await db.delete(polls).where(and(eq(polls.id, pollId), eq(polls.sessionId, sessionId), isNull(polls.openedAt)));
  revalidatePath(`/sessions/${sessionId}`);
}

// ---------- live tools ----------

/** Brings in demo students (run by the workers) so a teacher can try HandsUp alone. */
export async function addDemoStudents(sessionId: string) {
  const { session } = await requireOwnedSession(sessionId);
  if (session.status === "ended") return { ok: false as const, error: "This lecture has ended." };
  await publishControl({ type: "demo:start", sessionId, code: session.joinCode, count: LIMITS.demoStudents });
  return { ok: true as const };
}

/** Turns "Review questions before they appear" on or off during class. */
export async function setReviewFirst(sessionId: string, on: boolean) {
  const { session } = await requireOwnedSession(sessionId);
  await db
    .update(sessions)
    .set({ settings: { ...session.settings, reviewQuestionsFirst: on } })
    .where(eq(sessions.id, sessionId));
  await publishControl({ type: "session:updated", sessionId });
  revalidatePath(`/sessions/${sessionId}/live`);
}

// ---------- after class ----------

/** Rewrites the report (e.g. after adding a Gemini key). The report worker picks it up within seconds. */
export async function regenerateReport(sessionId: string) {
  await requireOwnedSession(sessionId);
  await db.update(reports).set({ generatedAt: null }).where(eq(reports.sessionId, sessionId));
  revalidatePath(`/sessions/${sessionId}/report`);
}

/** Creates (once) the public read-only link for a report. */
export async function shareReport(sessionId: string): Promise<string | null> {
  await requireOwnedSession(sessionId);
  const r = await db.query.reports.findFirst({ where: eq(reports.sessionId, sessionId), columns: { shareToken: true } });
  if (!r) return null;
  if (r.shareToken) return r.shareToken;
  const token = randomBytes(12).toString("base64url");
  await db.update(reports).set({ shareToken: token }).where(and(eq(reports.sessionId, sessionId), isNull(reports.shareToken)));
  const again = await db.query.reports.findFirst({ where: eq(reports.sessionId, sessionId), columns: { shareToken: true } });
  return again?.shareToken ?? null;
}

export async function unshareReport(sessionId: string) {
  await requireOwnedSession(sessionId);
  await db.update(reports).set({ shareToken: null }).where(eq(reports.sessionId, sessionId));
  revalidatePath(`/sessions/${sessionId}/report`);
}

/**
 * "Erase class data now": deletes everything students sent (taps, questions, votes, insights)
 * before the retention window ends. The report's numbers and summary stay.
 */
export async function eraseSessionData(sessionId: string) {
  const { session } = await requireOwnedSession(sessionId);
  if (session.status === "live") return { ok: false as const, error: "End the class first." };
  await db.transaction(async (tx) => {
    await tx.delete(events).where(eq(events.sessionId, sessionId));
    await tx.delete(insights).where(eq(insights.sessionId, sessionId));
    await tx.delete(questions).where(eq(questions.sessionId, sessionId));
    await tx.delete(clusters).where(eq(clusters.sessionId, sessionId));
    await tx.delete(students).where(eq(students.sessionId, sessionId));
    await tx.update(reports).set({ topQuestions: [] }).where(eq(reports.sessionId, sessionId));
  });
  revalidatePath(`/sessions/${sessionId}/report`);
  return { ok: true as const };
}
