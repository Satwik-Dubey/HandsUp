import { env } from "./env";

/** Error tracking, only when SENTRY_DSN is set. */
export async function initSentry() {
  if (!env.sentryDsn) return;
  const Sentry = await import("@sentry/node");
  Sentry.init({ dsn: env.sentryDsn, environment: process.env.NODE_ENV ?? "development", tracesSampleRate: 0 });
  process.on("unhandledRejection", (e) => Sentry.captureException(e));
  console.log("[workers] Sentry on");
}
