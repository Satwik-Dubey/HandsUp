import { createRedis } from "@handsup/server";
import { env } from "./env";

export const redis = createRedis(env.redisUrl, "redis");
/** Separate connections for pub/sub (a subscribed connection can't run other commands). */
export const pub = createRedis(env.redisUrl, "redis:pub");
export const sub = createRedis(env.redisUrl, "redis:sub");
