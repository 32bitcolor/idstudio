import "server-only";
import Redis from "ioredis";

// A plain ioredis client for simple app-side commands (e.g. the intake throttle).
// worker/index.ts deliberately keeps BullMQ's connection separate from this —
// reusing one ioredis instance across both trips a structural type mismatch — so
// this client is never passed into a Queue/Worker's `connection` option.
const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis = globalForRedis.redis ?? new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
