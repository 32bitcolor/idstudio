import "server-only";
import { headers } from "next/headers";
import { redis } from "@/lib/redis";

const WINDOW_SECONDS = 3600;
const MAX_PER_WINDOW = 5;

// Simple per-IP, per-workspace rate limit for the public (unauthenticated) intake
// form. Fails open if Redis is unreachable — a broken throttle must never be the
// reason a legitimate stakeholder's request silently vanishes.
export async function checkIntakeThrottle(workspaceId: string): Promise<boolean> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = `intake-throttle:${workspaceId}:${ip}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, WINDOW_SECONDS);
    return count <= MAX_PER_WINDOW;
  } catch {
    return true;
  }
}
