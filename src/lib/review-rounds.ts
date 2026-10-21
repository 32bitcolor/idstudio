import "server-only";
import { prisma } from "@/lib/db";

export type RoundOutcome = "passed" | "changes_requested";

/** The approval gate (decided 2026-10-20): a round passes only when EVERY reviewer has
 *  approved. Once everyone has decided and at least one asked for changes, the round
 *  ends as changes_requested. Until then it's open (null). */
export function computeOutcome(statuses: string[]): RoundOutcome | null {
  if (statuses.length === 0) return null;
  if (statuses.every((s) => s === "approved")) return "passed";
  if (statuses.every((s) => s === "approved" || s === "changes_requested")) return "changes_requested";
  return null;
}

/** Re-derive a round's outcome from its reviewers' decisions. An ADMIN/MANAGER
 *  override is final and never recomputed away; otherwise reopening a decision
 *  reopens the round. Returns the outcome before and after, so callers can tell
 *  when the round just closed. */
export async function syncRoundOutcome(roundId: string) {
  const round = await prisma.reviewRound.findUnique({
    where: { id: roundId },
    select: { outcome: true, closedAt: true, overriddenAt: true, assignments: { select: { status: true } } },
  });
  if (!round) return null;
  if (round.overriddenAt) return { before: round.outcome, after: round.outcome };
  const outcome = computeOutcome(round.assignments.map((a) => a.status));
  if (outcome !== round.outcome) {
    await prisma.reviewRound.update({
      where: { id: roundId },
      data: { outcome, closedAt: outcome ? (round.closedAt ?? new Date()) : null },
    });
  }
  return { before: round.outcome, after: outcome };
}
