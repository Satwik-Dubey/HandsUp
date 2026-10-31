import "server-only";
import { rk, type ControlMessage } from "@handsup/shared";
import { Redis } from "ioredis";

const g = globalThis as unknown as { __handsupRedis?: Redis };

export function getRedis(): Redis {
  if (!g.__handsupRedis) {
    g.__handsupRedis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: 2 });
    g.__handsupRedis.on("error", (e) => console.error("[redis]", e.message));
  }
  return g.__handsupRedis;
}

/** Tells the realtime gateway that a session changed (went live, ended, settings edited). */
export async function publishControl(msg: ControlMessage) {
  await getRedis().publish(rk.controlChannel, JSON.stringify(msg));
}
