/** Browser error tracking, only when NEXT_PUBLIC_SENTRY_DSN is set. Loaded lazily so it costs nothing otherwise. */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  void import("@sentry/nextjs").then((Sentry) => Sentry.init({ dsn, tracesSampleRate: 0 }));
}
