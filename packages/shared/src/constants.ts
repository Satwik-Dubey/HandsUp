/** The five reaction buttons on the student phone. Order is the display order. */
export const REACTIONS = ["gotIt", "tooFast", "tooSlow", "example", "confused"] as const;
export type Reaction = (typeof REACTIONS)[number];

export const REACTION_META: Record<Reaction, { emoji: string; label: string; short: string }> = {
  gotIt: { emoji: "👍", label: "Got it", short: "Got it" },
  tooFast: { emoji: "🐇", label: "Too fast", short: "Too fast" },
  tooSlow: { emoji: "🐢", label: "Too slow", short: "Too slow" },
  example: { emoji: "✋", label: "Example please", short: "Example?" },
  confused: { emoji: "😕", label: "I'm confused", short: "Confused" },
};

/** smallint codes for the `events.kind` column. Never renumber. */
export const EVENT_KIND = {
  gotIt: 1,
  confused: 2,
  tooFast: 3,
  tooSlow: 4,
  example: 5,
  rating: 6,
} as const;

export const SESSION_TEMPLATES = ["lecture", "lab", "tutorial", "review", "seminar"] as const;
export type SessionTemplate = (typeof SESSION_TEMPLATES)[number];

export const TEMPLATE_META: Record<SessionTemplate, { emoji: string; label: string }> = {
  lecture: { emoji: "🎓", label: "Lecture" },
  lab: { emoji: "🔬", label: "Lab" },
  tutorial: { emoji: "💬", label: "Tutorial" },
  review: { emoji: "📝", label: "Exam review" },
  seminar: { emoji: "🎤", label: "Seminar" },
};

export const SESSION_STATUSES = ["draft", "live", "ended"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const COURSE_COLORS = ["coral", "green", "yellow", "sky", "violet", "lime", "pink"] as const;
export type CourseColor = (typeof COURSE_COLORS)[number];

export const RETENTION_CHOICES = [7, 30, 90, 365] as const;

/** Tunables shared by the gateway and the clients. */
export const LIMITS = {
  /** Phones coalesce taps for this long before sending one `react` message. */
  reactBatchMs: 500,
  /** Heartbeat interval from phones. */
  heartbeatMs: 15_000,
  /** A student counts as "here" if seen within this window. */
  activeWindowMs: 60_000,
  /** Max taps of one kind accepted in a single `react` message. */
  maxTapsPerMessage: 20,
  /** Token bucket per device: capacity and refill per second. */
  bucketCapacity: 40,
  bucketRefillPerSec: 2,
  /** Join attempts per IP per minute (slows code guessing). */
  joinAttemptsPerMinute: 12,
  questionMaxLength: 280,
  /** Questions per device: burst of 3, then one every 20 s. */
  questionBucketCapacity: 3,
  questionRefillPerSec: 0.05,
  /** How many questions phones receive in `questions:top`. */
  topQuestions: 30,
  /** Length of one timeline window. */
  windowMs: 5000,
  pollMaxOptions: 6,
  pollOptionMaxLength: 80,
  /** How many demo students "Add demo students" brings in, and for how long. */
  demoStudents: 30,
  demoMinutes: 10,
} as const;

/** Tunables for the AI pipeline (design: "AI pipeline" and "Smart alert"). */
export const AI = {
  /** Cosine similarity needed to join a question group with the MiniLM model. */
  clusterSimilarity: 0.78,
  /** The same for the offline fallback (word-based vectors score lower). */
  clusterSimilarityFallback: 0.5,
  /** New groups form from unassigned questions asked in this window. */
  clusterLookbackMs: 10 * 60_000,
  /** Live insights from the LLM: at most once per room per this interval, and only when something changed. */
  llmIntervalMs: 60_000,
  /** The same rule doesn't fire twice in a session within this time. */
  ruleCooldownMs: 3 * 60_000,
  /** Rules stay quiet until this many students are active. */
  minActiveForAlerts: 5,
} as const;

/** Redis key names, from the design's "Redis keys" table. */
export const rk = {
  eventsStream: "events",
  questionsStream: "questions",
  count: (sid: string) => `s:${sid}:count`,
  second: (sid: string, epochSec: number) => `s:${sid}:sec:${epochSec}`,
  presence: (sid: string) => `s:${sid}:presence`,
  joined: (sid: string) => `s:${sid}:joined`,
  reactors: (sid: string, kind: Reaction | "any") => `s:${sid}:who:${kind}`,
  rating: (sid: string) => `s:${sid}:rating`,
  rateLimit: (sid: string, device: string) => `s:${sid}:rl:${device}`,
  seq: (sid: string, device: string) => `s:${sid}:seq:${device}`,
  poll: (sid: string, pollId: string) => `s:${sid}:poll:${pollId}`,
  teacherChannel: (sid: string) => `ch:s:${sid}:teacher`,
  /** Pattern the gateway subscribes to, to relay worker output to teachers. */
  teacherChannelPattern: "ch:s:*:teacher",
  /** JSON of the poll currently open in a session. */
  activePoll: (sid: string) => `s:${sid}:activePoll`,
  /** JSON of the current segment ("Slide 12"). */
  segment: (sid: string) => `s:${sid}:segment`,
  questionRateLimit: (sid: string, device: string) => `s:${sid}:rlq:${device}`,
  /** Set of session ids that are live, kept by the web app and read by workers. */
  liveSessions: "live_sessions",
  /** Web app → gateway notifications (session started/ended/updated). */
  controlChannel: "ch:control",
  joinAttempts: (ip: string) => `join:ip:${ip}`,
  /** Students the teacher muted: their new questions are hidden. */
  muted: (sid: string) => `s:${sid}:muted`,
  /** Cooldown flag for an alert rule (or rule + cluster). */
  ruleCooldown: (sid: string, rule: string) => `s:${sid}:cool:${rule}`,
  /** Lock so only one worker writes a session's report at a time. */
  reportLock: (sid: string) => `lock:report:${sid}`,
};
