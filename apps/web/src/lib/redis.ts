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

/**
 * Where the website reaches the realtime gateway from the server. When it's set (online), the
 * website doesn't use Redis at all: it asks the gateway, which sits next to Redis. That way the
 * website works on hosts that can't reach the Redis (Vercel + Render's free Redis).
 * Locally it's empty and the website talks to Redis directly, as before.
 */
function gatewayBase(): string | null {
  const url = process.env.GATEWAY_INTERNAL_URL || process.env.NEXT_PUBLIC_GATEWAY_URL;
  return url ? url.replace(/\/$/, "") : null;
}

async function callGateway<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const res = await fetch(`${gatewayBase()}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.REALTIME_SECRET ?? ""}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`gateway ${path} answered ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Tells the realtime gateway that a session changed (went live, ended, settings edited).
 * Never throws: the change is already saved in the database, and the gateway re-reads
 * sessions every 15 seconds anyway, so a lost message only delays it a little.
 */
export async function publishControl(msg: ControlMessage) {
  try {
    if (gatewayBase()) await callGateway("/internal/control", msg, 25_000);
    else await getRedis().publish(rk.controlChannel, JSON.stringify(msg));
  } catch (e) {
    console.error("[control] couldn't reach the live server:", (e as Error).message);
  }
}

/** Wrong join codes from this IP in the last minute. With `miss`, counts one more first. Fails open. */
export async function joinAttempts(ip: string, miss = false): Promise<number> {
  try {
    if (gatewayBase()) return (await callGateway<{ count: number }>("/internal/join-attempts", { ip, miss }, 8_000)).count;
    const redis = getRedis();
    const key = rk.joinAttempts(ip);
    if (miss) {
      const res = await redis.multi().incr(key).expire(key, 60).exec();
      return Number(res?.[0]?.[1] ?? 0);
    }
    return Number((await redis.get(key)) ?? 0);
  } catch (e) {
    console.error("[join] rate limit check skipped:", (e as Error).message);
    return 0;
  }
}
