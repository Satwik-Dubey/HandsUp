/**
 * Janitor: keeps the privacy promise.
 *  - Raw taps (`events`) are deleted after 7 days.
 *  - After a session's retention window ("Keep data for"), everything students sent is deleted:
 *    students, questions, votes, timeline windows and insights. The lecture itself stays in the course list.
 */
import { getDb, sql } from "@handsup/db";
import { env } from "./env";

const db = getDb(env.databaseUrl);
const HOUR = 3600_000;

async function sweep() {
  const ev = await db.execute(sql`delete from events where time < now() - interval '7 days'`);
  const expired = sql`select id from sessions where ended_at is not null and ended_at + make_interval(days => retention_days) < now()`;
  await db.execute(sql`delete from metrics_5s where session_id in (${expired})`);
  await db.execute(sql`delete from insights where session_id in (${expired})`);
  await db.execute(sql`delete from questions where session_id in (${expired})`);
  const st = await db.execute(sql`delete from students where session_id in (${expired})`);
  const n = (r: unknown) => (r as { count?: number }).count ?? 0;
  if (n(ev) || n(st)) console.log(`[janitor] removed ${n(ev)} old taps, ${n(st)} expired students`);
}

export function startJanitor() {
  const run = () => sweep().catch((e) => console.error("[janitor]", (e as Error).message));
  setTimeout(run, 10_000);
  setInterval(run, HOUR);
}
