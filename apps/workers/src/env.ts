function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[workers] Missing ${name}. Copy .env.example to .env in the repo root and fill it in.`);
    process.exit(1);
  }
  return v;
}

export const env = {
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  databaseUrl: required("DATABASE_URL"),
  /** Unique per running copy, so two workers in one consumer group don't steal each other's names. */
  consumerName: process.env.WORKER_NAME ?? `w-${process.pid}`,
  /** Live insights (optional). Without it, alerts still fire with built-in wording. */
  groqApiKey: process.env.GROQ_API_KEY || null,
  groqModel: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
  /** After-class report summary (optional). Without it, the report uses a written-by-rules summary. */
  geminiApiKey: process.env.GEMINI_API_KEY || null,
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  /** "off" skips downloading the local sentiment/embedding models and uses the word-based fallback. */
  localModels: (process.env.LOCAL_MODELS ?? "on") !== "off",
  modelsCacheDir: process.env.MODELS_CACHE_DIR || new URL("../../../.cache/models", import.meta.url).pathname,
  /** Where demo students connect. */
  gatewayUrl: process.env.GATEWAY_INTERNAL_URL || `http://localhost:${process.env.GATEWAY_PORT ?? 4000}`,
  sentryDsn: process.env.SENTRY_DSN || null,
};
