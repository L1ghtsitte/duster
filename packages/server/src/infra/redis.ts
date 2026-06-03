import { Redis } from "ioredis";
import { config } from "../config.js";

let client: Redis | null = null;

export function getRedis(): Redis | null {
  if (!config.redisUrl) return null;
  if (!client) {
    client = new Redis(config.redisUrl, { maxRetriesPerRequest: 2 });
    client.on("error", () => {
      console.warn("Redis error - cache/rate-limit degraded");
    });
  }
  return client;
}

export async function cacheGet(key: string): Promise<string | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    return await r.get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSec = 3600): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.setex(key, ttlSec, value);
  } catch {
    /* ignore */
  }
}

export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const r = getRedis();
  if (!r) return true;
  try {
    const n = await r.incr(key);
    if (n === 1) await r.expire(key, windowSec);
    return n <= limit;
  } catch {
    return true;
  }
}

export async function wsSetAgentOnline(computerId: string, online: boolean): Promise<void> {
  const r = getRedis();
  if (!r) return;
  const key = `ws:agent:${computerId}`;
  if (online) await r.setex(key, 120, "1");
  else await r.del(key);
}
