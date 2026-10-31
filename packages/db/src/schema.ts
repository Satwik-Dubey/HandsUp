/**
 * Full HandsUp schema from the design's data model.
 */
import { randomBytes } from "node:crypto";
import { relations } from "drizzle-orm";
import {
  bigserial,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import type { PollKind, SessionSettings } from "@handsup/shared";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

// ---------- what the teacher owns ----------

export const teachers = pgTable("teachers", {
  id: uuid().primaryKey().defaultRandom(),
  googleSub: text().notNull().unique(),
  email: text().notNull(),
  name: text(),
  image: text(),
  /** Shown to students, e.g. "Prof. Sharma". */
  displayName: text(),
  institution: text(),
  onboardedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
});

export const courses = pgTable(
  "courses",
  {
    id: uuid().primaryKey().defaultRandom(),
    teacherId: uuid().notNull().references(() => teachers.id, { onDelete: "cascade" }),
    name: text().notNull(),
    term: text().notNull().default(""),
    color: text().notNull().default("coral"),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.teacherId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    courseId: uuid().notNull().references(() => courses.id, { onDelete: "cascade" }),
    title: text().notNull(),
    joinCode: text().notNull().unique(),
    template: text().notNull().default("lecture"),
    status: text().$type<"draft" | "live" | "ended">().notNull().default("draft"),
    settings: jsonb().$type<SessionSettings>().notNull(),
    retentionDays: integer().notNull().default(30),
    /** Per-session salt so device hashes can't be linked across sessions. */
    salt: text()
      .notNull()
      .$defaultFn(() => randomBytes(16).toString("hex")),
    startsAt: timestamp({ withTimezone: true }),
    startedAt: timestamp({ withTimezone: true }),
    endedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.courseId), index().on(t.status)],
);

export const segments = pgTable(
  "segments",
  {
    id: uuid().primaryKey().defaultRandom(),
    sessionId: uuid().notNull().references(() => sessions.id, { onDelete: "cascade" }),
    label: text().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    source: text().notNull().default("manual"),
  },
  (t) => [index().on(t.sessionId, t.startsAt)],
);

export const polls = pgTable(
  "polls",
  {
    id: uuid().primaryKey().defaultRandom(),
    sessionId: uuid().notNull().references(() => sessions.id, { onDelete: "cascade" }),
    position: integer().notNull().default(0),
    question: text().notNull(),
    kind: text().$type<PollKind>().notNull().default("single"),
    options: jsonb().$type<string[]>().notNull().default([]),
    openedAt: timestamp({ withTimezone: true }),
    closedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.sessionId)],
);

export const reports = pgTable("reports", {
  sessionId: uuid().primaryKey().references(() => sessions.id, { onDelete: "cascade" }),
  summaryMd: text(),
  keyMoments: jsonb().$type<unknown[]>(),
  topQuestions: jsonb().$type<unknown[]>(),
  stats: jsonb().$type<Record<string, unknown>>(),
  pdfKey: text(),
  csvKey: text(),
  /** Per-lecture summaries for the report (added in v1.0). */
  segments: jsonb().$type<unknown[]>(),
  /** "gemini" or "template". */
  summarySource: text(),
  /** Set when the teacher copies a share link; anyone with /r/<token> can read the report. */
  shareToken: text().unique(),
  generatedAt: timestamp({ withTimezone: true }),
});

// ---------- who joined (anonymous, per session) ----------

export const students = pgTable(
  "students",
  {
    id: uuid().primaryKey().defaultRandom(),
    sessionId: uuid().notNull().references(() => sessions.id, { onDelete: "cascade" }),
    deviceHash: bytea().notNull(),
    joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex().on(t.sessionId, t.deviceHash)],
);

// ---------- what the crowd generates ----------

export const events = pgTable(
  "events",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    time: timestamp({ withTimezone: true }).notNull().defaultNow(),
    sessionId: uuid().notNull().references(() => sessions.id, { onDelete: "cascade" }),
    studentId: uuid().references(() => students.id, { onDelete: "set null" }),
    /** See EVENT_KIND in @handsup/shared. */
    kind: smallint().notNull(),
    /** Tap count, or 1–5 for a rating. */
    value: smallint().notNull(),
  },
  (t) => [index().on(t.sessionId, t.time)],
);

export const metrics5s = pgTable(
  "metrics_5s",
  {
    bucket: timestamp({ withTimezone: true }).notNull(),
    sessionId: uuid().notNull().references(() => sessions.id, { onDelete: "cascade" }),
    active: integer().notNull().default(0),
    joined: integer().notNull().default(0),
    reactions: jsonb().$type<Record<string, number>>().notNull().default({}),
    confusedRatio: real().notNull().default(0),
    /** Share of active students who reacted in the last minute. */
    engaged: real().notNull().default(0),
    avgRating: real(),
    understanding: real(),
    questionCount: integer().notNull().default(0),
    segmentId: uuid().references(() => segments.id, { onDelete: "set null" }),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.bucket] })],
);

export const clusters = pgTable(
  "clusters",
  {
    id: uuid().primaryKey().defaultRandom(),
    sessionId: uuid().notNull().references(() => sessions.id, { onDelete: "cascade" }),
    label: text(),
    size: integer().notNull().default(0),
    centroid: vector({ dimensions: 384 }),
    representativeId: uuid(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.sessionId)],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid().primaryKey().defaultRandom(),
    sessionId: uuid().notNull().references(() => sessions.id, { onDelete: "cascade" }),
    studentId: uuid().references(() => students.id, { onDelete: "set null" }),
    /** Client-generated id so retries after a reconnect don't create duplicates. */
    clientId: text().notNull(),
    body: text().notNull(),
    sentiment: real(),
    embedding: vector({ dimensions: 384 }),
    clusterId: uuid().references(() => clusters.id, { onDelete: "set null" }),
    status: text().$type<"open" | "answered" | "hidden" | "pending">().notNull().default("open"),
    upvotes: integer().notNull().default(0),
    segmentId: uuid().references(() => segments.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.sessionId, t.createdAt),
    uniqueIndex().on(t.sessionId, t.clientId),
    index("questions_embedding_hnsw").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

export const pollVotes = pgTable(
  "poll_votes",
  {
    pollId: uuid().notNull().references(() => polls.id, { onDelete: "cascade" }),
    studentId: uuid().notNull().references(() => students.id, { onDelete: "cascade" }),
    choice: jsonb().notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.pollId, t.studentId] }), index().on(t.studentId)],
);

export const questionVotes = pgTable(
  "question_votes",
  {
    questionId: uuid().notNull().references(() => questions.id, { onDelete: "cascade" }),
    studentId: uuid().notNull().references(() => students.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.questionId, t.studentId] }), index().on(t.studentId)],
);

export const insights = pgTable(
  "insights",
  {
    id: uuid().primaryKey().defaultRandom(),
    sessionId: uuid().notNull().references(() => sessions.id, { onDelete: "cascade" }),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    kind: text().$type<"alert" | "suggestion" | "cluster" | "moment">().notNull(),
    severity: text().$type<"info" | "warn" | "alert">().notNull().default("info"),
    message: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>(),
    acknowledgedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.sessionId, t.at)],
);

// ---------- relations (for db.query.*) ----------

export const teachersRelations = relations(teachers, ({ many }) => ({ courses: many(courses) }));
export const coursesRelations = relations(courses, ({ one, many }) => ({
  teacher: one(teachers, { fields: [courses.teacherId], references: [teachers.id] }),
  sessions: many(sessions),
}));
export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  course: one(courses, { fields: [sessions.courseId], references: [courses.id] }),
  students: many(students),
  segments: many(segments),
  polls: many(polls),
}));
export const studentsRelations = relations(students, ({ one }) => ({
  session: one(sessions, { fields: [students.sessionId], references: [sessions.id] }),
}));
export const segmentsRelations = relations(segments, ({ one }) => ({
  session: one(sessions, { fields: [segments.sessionId], references: [sessions.id] }),
}));
export const pollsRelations = relations(polls, ({ one }) => ({
  session: one(sessions, { fields: [polls.sessionId], references: [sessions.id] }),
}));

export type Teacher = typeof teachers.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Student = typeof students.$inferSelect;
