/** Server-side error tracking, only when SENTRY_DSN is set. */
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0, environment: process.env.NODE_ENV });
}

export async function onRequestError(...args: unknown[]) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Sentry.captureRequestError as any)(...args);
}
