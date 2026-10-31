import { z } from "zod";
import { COURSE_COLORS, LIMITS, RETENTION_CHOICES, SESSION_TEMPLATES } from "./constants";

/** What students can do in a session. Stored in sessions.settings.inputs. */
export const sessionInputsSchema = z.object({
  react: z.boolean().default(true),
  confused: z.boolean().default(true),
  rating: z.boolean().default(true),
  questions: z.boolean().default(true),
  pollResults: z.boolean().default(true),
});
export type SessionInputs = z.infer<typeof sessionInputsSchema>;

export const sessionSettingsSchema = z.object({
  inputs: sessionInputsSchema.default({}),
  reviewQuestionsFirst: z.boolean().default(false),
});
export type SessionSettings = z.infer<typeof sessionSettingsSchema>;

export const DEFAULT_SETTINGS: SessionSettings = sessionSettingsSchema.parse({});

// ---------- REST / form bodies ----------

export const createCourseSchema = z.object({
  name: z.string().trim().min(2, "Give the course a name").max(120),
  term: z.string().trim().max(40).optional().default(""),
  color: z.enum(COURSE_COLORS).default("coral"),
});
export type CreateCourseInput = z.infer<typeof createCourseSchema>;

export const createSessionSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().trim().min(2, "Give the lecture a title").max(160),
  template: z.enum(SESSION_TEMPLATES).default("lecture"),
  startsAt: z.string().datetime({ offset: true }).optional().nullable(),
  retentionDays: z.coerce
    .number()
    .refine((n) => (RETENTION_CHOICES as readonly number[]).includes(n))
    .default(30),
  settings: sessionSettingsSchema.default({}),
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

/** GET /api/join/:code response. */
export const joinInfoSchema = z.object({
  code: z.string(),
  title: z.string(),
  status: z.enum(["draft", "live", "ended"]),
  courseName: z.string(),
  teacherName: z.string().nullable(),
  startsAt: z.string().nullable(),
  inputs: sessionInputsSchema,
});
export type JoinInfo = z.infer<typeof joinInfoSchema>;

export const questionTextSchema = z.string().trim().min(2).max(LIMITS.questionMaxLength);

export const createPollSchema = z
  .object({
    sessionId: z.string().uuid(),
    question: z.string().trim().min(2, "Write the poll question").max(200),
    kind: z.enum(["single", "multi", "rating"]),
    options: z.array(z.string().trim().min(1).max(80)).max(6),
  })
  .refine((p) => p.kind === "rating" || p.options.length >= 2, { message: "Add at least two options", path: ["options"] });
export type CreatePollInput = z.infer<typeof createPollSchema>;

export const RATING_OPTIONS = ["1", "2", "3", "4", "5"];
