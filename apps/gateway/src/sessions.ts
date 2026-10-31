import { courses, eq, getDb, sessions, teachers } from "@handsup/db";
import { DEFAULT_SETTINGS, type SessionInputs } from "@handsup/shared";
import { env } from "./env";

export interface LiveSession {
  id: string;
  code: string;
  title: string;
  status: "draft" | "live" | "ended";
  salt: string;
  courseName: string;
  teacherId: string;
  teacherName: string | null;
  inputs: SessionInputs;
  reviewQuestionsFirst: boolean;
}

const db = getDb(env.databaseUrl);
const TTL_MS = 15_000;
const byId = new Map<string, { at: number; s: LiveSession }>();
const idByCode = new Map<string, string>();

async function load(where: { id?: string; code?: string }): Promise<LiveSession | null> {
  const rows = await db
    .select({
      id: sessions.id,
      code: sessions.joinCode,
      title: sessions.title,
      status: sessions.status,
      salt: sessions.salt,
      settings: sessions.settings,
      courseName: courses.name,
      teacherId: teachers.id,
      teacherName: teachers.displayName,
      teacherFullName: teachers.name,
    })
    .from(sessions)
    .innerJoin(courses, eq(courses.id, sessions.courseId))
    .innerJoin(teachers, eq(teachers.id, courses.teacherId))
    .where(where.id ? eq(sessions.id, where.id) : eq(sessions.joinCode, where.code!))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  const s: LiveSession = {
    id: r.id,
    code: r.code,
    title: r.title,
    status: r.status,
    salt: r.salt,
    courseName: r.courseName,
    teacherId: r.teacherId,
    teacherName: r.teacherName ?? r.teacherFullName,
    inputs: { ...DEFAULT_SETTINGS.inputs, ...(r.settings?.inputs ?? {}) },
    reviewQuestionsFirst: Boolean(r.settings?.reviewQuestionsFirst),
  };
  byId.set(s.id, { at: Date.now(), s });
  idByCode.set(s.code, s.id);
  return s;
}

export async function getSessionByCode(code: string): Promise<LiveSession | null> {
  const id = idByCode.get(code);
  if (id) {
    const hit = byId.get(id);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.s;
  }
  return load({ code });
}

export async function getSessionById(id: string): Promise<LiveSession | null> {
  const hit = byId.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.s;
  return load({ id });
}

/** Called when the web app says a session changed; the next lookup goes to the database. */
export function invalidateSession(id: string) {
  byId.delete(id);
}
