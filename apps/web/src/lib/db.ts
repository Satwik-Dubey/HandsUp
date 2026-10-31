import "server-only";
import { getDb, type Db } from "@handsup/db";

/** Connects on first use, so importing this during `next build` doesn't need a database. */
export const db = new Proxy({} as Db, {
  get: (_t, prop) => Reflect.get(getDb(), prop),
});
