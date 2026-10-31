import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";
export { schema };
export * from "drizzle-orm";

export type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __handsupDb?: Db; __handsupSql?: postgres.Sql };

/**
 * One connection pool per process. In Next.js dev, hot reload re-runs modules,
 * so the pool is kept on globalThis to avoid leaking connections.
 */
export function getDb(url = process.env.DATABASE_URL): Db {
  if (globalForDb.__handsupDb) return globalForDb.__handsupDb;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env in the repo root.");
  const sql = postgres(url, { max: Number(process.env.DB_POOL_MAX ?? 10), prepare: false });
  const db = drizzle(sql, { schema, casing: "snake_case" });
  globalForDb.__handsupSql = sql;
  globalForDb.__handsupDb = db;
  return db;
}

export async function closeDb() {
  await globalForDb.__handsupSql?.end({ timeout: 5 });
  globalForDb.__handsupDb = undefined;
  globalForDb.__handsupSql = undefined;
}
export * from "./queries";
