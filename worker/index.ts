import { Worker, Queue, type ConnectionOptions } from "bullmq";

// Background job runner. Phase 5 registers real LearnUpon sync jobs here; for
// now it stays alive and confirms the app ⇄ Redis ⇄ worker topology works.

// Let BullMQ own its Redis connections (avoids passing a shared ioredis instance,
// which trips a structural type mismatch between bullmq's and our ioredis types).
const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
const connection: ConnectionOptions = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
};

export const lmsQueue = new Queue("lms-sync", { connection });

const worker = new Worker(
  "lms-sync",
  async (job) => {
    console.log(`[worker] processing job ${job.id} (${job.name})`);
    return { ok: true };
  },
  { connection },
);

worker.on("ready", () => console.log("[worker] ready — listening on queue 'lms-sync'"));
worker.on("failed", (job, err) => console.error(`[worker] job ${job?.id} failed:`, err));

console.log("[worker] starting…");

async function shutdown() {
  console.log("[worker] shutting down…");
  await worker.close();
  await lmsQueue.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
