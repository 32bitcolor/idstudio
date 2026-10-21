import "server-only";
import { prisma } from "@/lib/db";
import { isApproval, isDecided, type ReviewDecision } from "@/lib/methodology";
import { enqueueEmail } from "@/lib/queues";
import { reviewDecided, withLink } from "@/lib/email-templates";
import { notificationsEnabled } from "@/lib/notify";
import { appUrl } from "@/lib/app-url";
import { diffSnapshots, parseSnapshot } from "@/lib/review-snapshot";
import { parseAnchor } from "@/lib/review-anchor";

export type RoundOutcome = "passed" | "changes_requested";

/** The approval gate (decided 2026-10-20): a round passes only when EVERY reviewer has
 *  approved ("approved with minor changes" counts). Once everyone has decided and at
 *  least one asked for changes, the round ends as changes_requested. Until then it's
 *  open (null). */
export function computeOutcome(statuses: string[]): RoundOutcome | null {
  if (statuses.length === 0) return null;
  if (statuses.every(isApproval)) return "passed";
  if (statuses.every(isDecided)) return "changes_requested";
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

/** After a reviewer decides: one email to whoever requested the review, with how much
 *  feedback came with it (docs/REVIEW-LINKS.md, locked decision 7) — e.g. "14 comments,
 *  3 on screens changed since round 1". Members and guests decide through different
 *  actions; both end up here. `actorId` is the deciding member, if any (no self-mail). */
export async function notifyReviewDecided(assignmentId: string, actorId: string | null) {
  const a = await prisma.reviewCycle.findUnique({
    where: { id: assignmentId },
    select: {
      status: true,
      feedback: true,
      reviewerId: true,
      guestId: true,
      roundId: true,
      reviewRound: { select: { number: true, snapshot: true, deliverableId: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
      reviewer: { select: { name: true, email: true } },
      guest: { select: { name: true } },
      deliverable: { select: { name: true, project: { select: { name: true, workspaceId: true } } } },
    },
  });
  if (!a || !isDecided(a.status)) return;
  const to = a.requestedBy;
  if (!to?.email || to.id === actorId) return;
  if (!(await notificationsEnabled(a.deliverable.project.workspaceId, "review"))) return;

  // This reviewer's own threads in the round, and how many sit on changed screens.
  const threads = await prisma.reviewComment.findMany({
    where: { roundId: a.roundId, parentId: null, ...(a.guestId ? { guestId: a.guestId } : { authorId: a.reviewerId }) },
    select: { anchor: true },
  });
  let onChanged = 0;
  let previousNumber: number | null = null;
  const prev = await prisma.reviewRound.findFirst({
    where: { deliverableId: a.reviewRound.deliverableId, number: { lt: a.reviewRound.number } },
    orderBy: { number: "desc" },
    select: { number: true, snapshot: true },
  });
  const curr = parseSnapshot(a.reviewRound.snapshot);
  const before = prev ? parseSnapshot(prev.snapshot) : null;
  if (curr && before && prev) {
    previousNumber = prev.number;
    const diff = diffSnapshots(before, curr);
    for (const t of threads) {
      const anchor = parseAnchor(t.anchor);
      if (anchor.kind === "storyboard_field" && diff.screens[anchor.screenId]?.kind !== "unchanged") onChanged++;
    }
  }

  await enqueueEmail({
    to: to.email,
    ...withLink(
      reviewDecided({
        requesterName: to.name ?? to.email,
        deliverableName: a.deliverable.name,
        projectName: a.deliverable.project.name,
        reviewerName: a.guest ? `${a.guest.name} (guest)` : a.reviewer ? a.reviewer.name ?? a.reviewer.email : "A reviewer",
        decision: a.status as ReviewDecision,
        feedback: a.feedback,
        commentCount: threads.length,
        changedCount: previousNumber != null ? onChanged : null,
        previousNumber,
      }),
      appUrl(`/reviews/${a.roundId}`),
    ),
  });
}
