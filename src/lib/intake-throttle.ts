import "server-only";
import { checkThrottle, clientIp } from "@/lib/throttle";

// Simple per-IP, per-workspace rate limit for the public (unauthenticated) intake form.
export async function checkIntakeThrottle(workspaceId: string): Promise<boolean> {
  return checkThrottle(`intake:${workspaceId}:${await clientIp()}`, 5, 3600);
}
