function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[gateway] Missing ${name}. Copy .env.example to .env in the repo root and fill it in.`);
    process.exit(1);
  }
  return v;
}

export const env = {
  // Hosts like Railway set PORT; locally GATEWAY_PORT (default 4000) is used.
  port: Number(process.env.PORT ?? process.env.GATEWAY_PORT ?? 4000),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  databaseUrl: required("DATABASE_URL"),
  realtimeSecret: new TextEncoder().encode(required("REALTIME_SECRET")),
  /** The same secret as text, to check the website's server-to-server calls (/internal/...). */
  realtimeSecretText: required("REALTIME_SECRET"),
  corsOrigins: (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  isProd: process.env.NODE_ENV === "production",
  /** How many entries the Redis streams keep (approximately). Lower it on a small Redis. */
  streamMaxLen: String(Number(process.env.STREAM_MAXLEN) || 100000),
};
