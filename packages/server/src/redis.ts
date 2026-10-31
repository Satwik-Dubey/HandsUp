import { Redis, type Result } from "ioredis";

/** Token bucket. Returns 1 if `cost` tokens were taken, 0 if over the limit. KEYS[1]=bucket  ARGV: capacity, refill/sec, nowMs, cost */
const TOKEN_BUCKET = `
local cap = tonumber(ARGV[1]); local rate = tonumber(ARGV[2]); local now = tonumber(ARGV[3]); local cost = tonumber(ARGV[4])
local b = redis.call('HMGET', KEYS[1], 't', 'ts')
local tokens = tonumber(b[1]) or cap
local ts = tonumber(b[2]) or now
tokens = math.min(cap, tokens + (now - ts) / 1000 * rate)
local ok = 0
if tokens >= cost then tokens = tokens - cost; ok = 1 end
redis.call('HSET', KEYS[1], 't', tokens, 'ts', now)
redis.call('PEXPIRE', KEYS[1], math.ceil(cap / rate * 1000) + 1000)
return ok`;

/** Accepts seq only if it is greater than the last accepted one. Returns 1 if accepted. */
const SEQ_CHECK = `
local last = tonumber(redis.call('GET', KEYS[1]) or '-1')
if tonumber(ARGV[1]) <= last then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'EX', 43200)
return 1`;

declare module "ioredis" {
  interface RedisCommander<Context> {
    takeTokens(key: string, cap: number, rate: number, now: number, cost: number): Result<number, Context>;
    acceptSeq(key: string, seq: number): Result<number, Context>;
  }
}

/** A Redis connection with the HandsUp Lua commands registered. */
export function createRedis(url = process.env.REDIS_URL ?? "redis://localhost:6379", name = "redis"): Redis {
  const r = new Redis(url, { maxRetriesPerRequest: 3 });
  r.on("error", (e) => console.error(`[${name}]`, e.message));
  r.defineCommand("takeTokens", { numberOfKeys: 1, lua: TOKEN_BUCKET });
  r.defineCommand("acceptSeq", { numberOfKeys: 1, lua: SEQ_CHECK });
  return r;
}

export type { Redis };
