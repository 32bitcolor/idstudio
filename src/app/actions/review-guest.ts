"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { REVIEW_DECISIONS } from "@/lib/methodology";
import { getGuestSession, guestPagePath } from "@/lib/review-guest";
import { createRoundComment, toCommentDTO } from "@/lib/review-comments";
import { notifyReviewDecided, syncRoundOutcome } from "@/lib/review-rounds";
import { checkThrottle } from "@/lib/throttle";

// Server actions for guest reviewers. Identity comes ONLY from the path-scoped cookie
// (lib/review-guest.ts) — the guestId argument just says which cookie path we're on,
// and a request without the matching credential gets nothing. Each action can reach
// exactly the one round that credential names.

async function session(guestId: string) {
  const s = await getGuestSession(guestId);
  return "session" in s ? s.session : null;
}

function refresh(guestId: string, roundId: string) {
  revalidatePath(guestPagePath(guestId));
  revalidatePath(`/reviews/${roundId}`);
}

export async function guestAddComment(guestId: string, anchor: unknown, body: string, parentId?: string | null) {
  const s = await session(guestId);
  if (!s) return { error: "This review link is no longer valid." };
  if (!s.canComment) {
    return { error: s.decided ? "Reopen your decision to add comments." : "This review is closed." };
  }
  if (!(await checkThrottle(`guest-comment:${s.guestId}`, 300, 3600))) {
    return { error: "That's a lot of comments in an hour — please wait a little." };
  }
  const created = await createRoundComment({ roundId: s.roundId, by: { guestId: s.guestId }, anchor, body, parentId });
  if ("error" in created) return { error: created.error };
  refresh(guestId, s.roundId);
  return { comment: toCommentDTO(created.row, "guest") };
}

/** Guests can delete their own comments while the round is still theirs to edit. */
export async function guestDeleteComment(guestId: string, commentId: string) {
  const s = await session(guestId);
  if (!s) return { error: "This review link is no longer valid." };
  if (!s.canComment) return { error: "This review can't be changed now." };
  const c = await prisma.reviewComment.findFirst({
    where: { id: commentId, roundId: s.roundId, guestId: s.guestId },
    select: { id: true },
  });
  if (!c) return { error: "You can only delete your own comments." };
  await prisma.reviewComment.delete({ where: { id: c.id } });
  refresh(guestId, s.roundId);
}

/** Approve / approve with minor changes / request changes, with an optional summary. */
export async function guestDecide(guestId: string, decision: string, summary: string) {
  const s = await session(guestId);
  if (!s) return { error: "This review link is no longer valid." };
  if (!s.canDecide) return { error: "This review is closed." };
  const parsed = z.enum(REVIEW_DECISIONS).safeParse(decision);
  if (!parsed.success) return { error: "Pick a decision." };
  const feedback = summary.trim() ? summary.trim().slice(0, 5000) : null;
  await prisma.reviewCycle.update({
    where: { id: s.assignmentId },
    data: { status: parsed.data, feedback, decidedAt: new Date() },
  });
  await syncRoundOutcome(s.roundId);
  refresh(guestId, s.roundId);
  revalidatePath("/my-work", "layout");
  await notifyReviewDecided(s.assignmentId, null);
}

/** Take a decision back while the round is still open, to keep commenting. */
export async function guestReopen(guestId: string) {
  const s = await session(guestId);
  if (!s) return { error: "This review link is no longer valid." };
  if (!s.canDecide) return { error: "This review is closed." };
  await prisma.reviewCycle.update({ where: { id: s.assignmentId }, data: { status: "in_review", decidedAt: null } });
  await syncRoundOutcome(s.roundId);
  refresh(guestId, s.roundId);
}
