/**
 * Runs `fn(key)` at most once per `ms` per key, always with the latest state:
 * the first call runs right away, calls during the wait collapse into one trailing run.
 */
export function keyedThrottle(ms: number, fn: (key: string) => void | Promise<void>) {
  const last = new Map<string, number>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return (key: string) => {
    if (timers.has(key)) return;
    const wait = Math.max(0, (last.get(key) ?? 0) + ms - Date.now());
    timers.set(
      key,
      setTimeout(async () => {
        timers.delete(key);
        last.set(key, Date.now());
        try {
          await fn(key);
        } catch (e) {
          console.error("[throttle]", key, (e as Error).message);
        }
      }, wait),
    );
  };
}
