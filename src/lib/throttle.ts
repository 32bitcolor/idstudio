import "server-only";
import { headers } from "next/headers";
import { redis } from "@/lib/redis";

/** The caller's IP as Caddy / Cloudflare forwarded it. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

// Fixed-window counter in Redis. Fails open if Redis is unreachable — a broken
// throttle must never be the reason a legitimate outsider is locked out.
export async function checkThrottle(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const count = await redis.incr(`throttle:${key}`);
    if (count === 1) await redis.expire(`throttle:${key}`, windowSeconds);
    return count <= max;
  } catch {
    return true;
  }
}
