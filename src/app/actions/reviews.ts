"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/dal";
import {
  getDeliverableForUser,
  getReviewForUser,
  getReviewRoundForUser,
  getReviewCommentForUser,
  isElevatedInWorkspace,
} from "@/lib/authz";
import { REVIEW_STATUSES } from "@/lib/methodology";
import { enqueueEmail } from "@/lib/queues";
import { reviewRequested, reviewDecided, mentioned, withLink } from "@/lib/email-templates";
import { notificationsEnabled } from "@/lib/notify";
import { appUrl } from "@/lib/app-url";
import { buildSnapshot } from "@/lib/review-snapshot";
import { validateAnchor } from "@/lib/review-anchor";
import { syncRoundOutcome } from "@/lib/review-rounds";
import { extractMentionIds, extractText } from "@/lib/mentions";

function fmtDate(d: Date | null): string | null {
  return d ? d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
}

// Review changes surface in the personal "My Work" hub too — refresh the whole
// /my-work subtree (Overview + Review History), the project page, the round's own
// page, and the root layout (the header's "awaiting your review" notification badge).
function revalidateReview(projectId: string, roundId?: string) {
  revalidatePath(`/projects/${projectId}`);
  if (roundId) revalidatePath(`/reviews/${roundId}`);
  revalidatePath("/my-work", "layout");
  revalidatePath("/", "layout");
}

// ── Rounds ────────────────────────────────────────────────────────────────────

/** Start the next review round on a deliverable: freeze what's being reviewed (the
 *  linked storyboard, if any), assign one or more reviewers, and email each of them. */
export async function startReviewRound(deliverableId: string, reviewerIds: string[], dueIso: string | null) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not signed in." };
  const d = await getDeliverableForUser(deliverableId);
  if (!d) return { error: "Deliverable not found." };

  const ids = [...new Set(reviewerIds)].filter(Boolean);
  if (ids.length === 0) return { error: "Pick at least one reviewer." };
  if (ids.length > 20) return { error: "Too many reviewers." };

  const project = await prisma.project.findUnique({ where: { id: d.projectId }, select: { workspaceId: true, name: true } });
  if (!project) return { error: "Project not found." };
  const members = await prisma.membership.findMany({
    where: { userId: { in: ids }, workspaceId: project.workspaceId },
    select: { userId: true },
  });
  if (members.length !== ids.length) return { error: "Every reviewer must be a workspace member." };

  const dueDate = dueIso ? new Date(dueIso) : null;
  if (dueIso && Number.isNaN(dueDate!.getTime())) return { error: "Invalid date." };

  // Freeze the linked storyboard (screens in order) — comments anchor to this copy.
  const storyboard = await prisma.storyboard.findUnique({
    where: { deliverableId },
    select: {
      id: true,
      title: true,
      screens: {
        orderBy: { position: "asc" },
        select: {
          id: true, title: true, screenType: true,
          onScreenText: true, narration: true, visualNotes: true, interactionNotes: true, developerNotes: true,
        },
      },
    },
  });
  const snapshot = storyboard ? buildSnapshot(storyboard) : null;

  // Next number + insert atomically under Serializable isolation, so two concurrent
  // requests can't mint the same round.
  let round;
  try {
    round = await prisma.$transaction(
      async (tx) => {
        const last = await tx.reviewRound.findFirst({
          where: { deliverableId },
          orderBy: { number: "desc" },
          select: { number: true },
        });
        const number = (last?.number ?? 0) + 1;
        return tx.reviewRound.create({
          data: {
            deliverableId,
            number,
            targetKind: snapshot ? "storyboard" : "none",
            snapshot: snapshot ?? Prisma.JsonNull,
            dueDate,
            createdById: me.id,
            assignments: {
              create: ids.map((reviewerId) => ({ deliverableId, reviewerId, requestedById: me.id, round: number, dueDate })),
            },
          },
          select: {
            id: true,
            number: true,
            assignments: { select: { reviewer: { select: { id: true, name: true, email: true } } } },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch {
    return { error: "Couldn't start the review — please try again." };
  }
  revalidateReview(d.projectId, round.id);

  if (await notificationsEnabled(project.workspaceId, "review")) {
    const meta = await prisma.deliverable.findUnique({ where: { id: deliverableId }, select: { name: true } });
    for (const { reviewer } of round.assignments) {
      if (!reviewer.email || reviewer.id === me.id) continue;
      await enqueueEmail({
        to: reviewer.email,
        ...withLink(
          reviewRequested({
            reviewerName: reviewer.name ?? reviewer.email,
            deliverableName: meta?.name ?? "",
            projectName: project.name,
            requesterName: me.name ?? me.email,
            dueDate: fmtDate(dueDate),
          }),
          appUrl(`/reviews/${round.id}`),
        ),
      });
    }
  }

  return { roundId: round.id, number: round.number };
}

/** Add another reviewer to an open round. */
export async function addRoundReviewer(roundId: string, reviewerId: string) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not signed in." };
  const r = await getReviewRoundForUser(roundId);
  if (!r) return { error: "Review round not found." };
  const round = await prisma.reviewRound.findUnique({ where: { id: roundId }, select: { closedAt: true, dueDate: true } });
  if (round?.closedAt) return { error: "This round is closed — start a new round instead." };
  const member = await prisma.membership.findFirst({
    where: { userId: reviewerId, workspaceId: r.deliverable.project.workspaceId },
    select: { id: true },
  });
  if (!member) return { error: "Reviewer must be a workspace member." };
  try {
    await prisma.reviewCycle.create({
      data: {
        deliverableId: r.deliverableId,
        roundId,
        reviewerId,
        requestedById: me.id,
        round: r.number,
        dueDate: round?.dueDate ?? null,
      },
    });
  } catch {
    return { error: "They're already reviewing this round." };
  }
  await syncRoundOutcome(roundId);
  revalidateReview(r.deliverable.projectId, roundId);
}

/** ADMIN/MANAGER only: pass a round without every approval (e.g. an SME went silent).
 *  The reason is required and recorded; reviewers' own decisions are left as they are. */
export async function overrideReviewRound(roundId: string, reason: string) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not signed in." };
  const r = await getReviewRoundForUser(roundId);
  if (!r) return { error: "Review round not found." };
  if (!(await isElevatedInWorkspace(r.deliverable.project.workspaceId))) {
    return { error: "Only admins and managers can override a review." };
  }
  const why = z.string().trim().min(3).max(1000).safeParse(reason);
  if (!why.success) return { error: "Give a short reason for the override." };
  const round = await prisma.reviewRound.findUnique({ where: { id: roundId }, select: { outcome: true } });
  if (round?.outcome === "passed") return { error: "This round has already passed." };

  await prisma.reviewRound.update({
    where: { id: roundId },
    data: { outcome: "passed", closedAt: new Date(), overriddenById: me.id, overriddenAt: new Date(), overrideReason: why.data },
  });
  revalidateReview(r.deliverable.projectId, roundId);
}

export async function deleteReviewRound(roundId: string) {
  const r = await getReviewRoundForUser(roundId);
  if (!r) return { error: "Review round not found." };
  await prisma.reviewRound.delete({ where: { id: roundId } });
  revalidateReview(r.deliverable.projectId);
}

// ── One reviewer's assignment ────────────────────────────────────────────────

export async function setReviewStatus(reviewId: string, status: string) {
  const r = await getReviewForUser(reviewId);
  if (!r) return { error: "Review not found." };
  const parsed = z.enum(REVIEW_STATUSES).safeParse(status);
  if (!parsed.success) return { error: "Invalid status." };
  const decided = parsed.data === "approved" || parsed.data === "changes_requested";
  const row = await prisma.reviewCycle.update({
    where: { id: reviewId },
    data: { status: parsed.data, decidedAt: decided ? new Date() : null },
    select: { roundId: true },
  });
  await syncRoundOutcome(row.roundId);
  revalidateReview(r.deliverable.projectId, row.roundId);

  // A decision notifies whoever requested the review.
  if (decided) {
    const me = await getCurrentUser();
    const detail = await prisma.reviewCycle.findUnique({
      where: { id: reviewId },
      select: {
        feedback: true,
        requestedBy: { select: { id: true, name: true, email: true } },
        reviewer: { select: { name: true, email: true } },
        deliverable: { select: { name: true, project: { select: { name: true, workspaceId: true } } } },
      },
    });
    if (
      detail?.requestedBy?.email &&
      detail.requestedBy.id !== me?.id &&
      (await notificationsEnabled(detail.deliverable.project.workspaceId, "review"))
    ) {
      await enqueueEmail({
        to: detail.requestedBy.email,
        ...withLink(
          reviewDecided({
            requesterName: detail.requestedBy.name ?? detail.requestedBy.email,
            deliverableName: detail.deliverable.name,
            projectName: detail.deliverable.project.name,
            reviewerName: detail.reviewer.name ?? detail.reviewer.email,
            decision: parsed.data as "approved" | "changes_requested",
            feedback: detail.feedback,
          }),
          appUrl(`/reviews/${row.roundId}`),
        ),
      });
    }
  }
}

export async function setReviewFeedback(reviewId: string, feedback: string) {
  const r = await getReviewForUser(reviewId);
  if (!r) return { error: "Review not found." };
  const row = await prisma.reviewCycle.update({
    where: { id: reviewId },
    data: { feedback: feedback.trim() ? feedback.slice(0, 5000) : null },
    select: { roundId: true },
  });
  revalidateReview(r.deliverable.projectId, row.roundId);
}

export async function setReviewDue(reviewId: string, dueIso: string | null) {
  const r = await getReviewForUser(reviewId);
  if (!r) return { error: "Review not found." };
  const dueDate = dueIso ? new Date(dueIso) : null;
  if (dueIso && Number.isNaN(dueDate!.getTime())) return { error: "Invalid date." };
  const row = await prisma.reviewCycle.update({ where: { id: reviewId }, data: { dueDate }, select: { roundId: true } });
  revalidateReview(r.deliverable.projectId, row.roundId);
}

/** Remove one reviewer from a round; removing the last one removes the round. */
export async function deleteReviewCycle(reviewId: string) {
  const r = await getReviewForUser(reviewId);
  if (!r) return { error: "Review not found." };
  const row = await prisma.reviewCycle.delete({ where: { id: reviewId }, select: { roundId: true } });
  const left = await prisma.reviewCycle.count({ where: { roundId: row.roundId } });
  if (left === 0) {
    await prisma.reviewRound.delete({ where: { id: row.roundId } });
    revalidateReview(r.deliverable.projectId);
    return;
  }
  await syncRoundOutcome(row.roundId);
  revalidateReview(r.deliverable.projectId, row.roundId);
}

// ── Comments ─────────────────────────────────────────────────────────────────

export type ReviewCommentDTO = {
  id: string;
  parentId: string | null;
  body: string;
  anchor: unknown;
  status: string;
  resolvedNote: string | null;
  resolvedBy: string | null;
  createdAt: string;
  author: { id: string; name: string | null; email: string } | null;
};

const COMMENT_SELECT = {
  id: true,
  parentId: true,
  body: true,
  anchor: true,
  status: true,
  resolvedNote: true,
  createdAt: true,
  resolvedBy: { select: { name: true, email: true } },
  author: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ReviewCommentSelect;

function toDTO(c: Prisma.ReviewCommentGetPayload<{ select: typeof COMMENT_SELECT }>): ReviewCommentDTO {
  return {
    id: c.id,
    parentId: c.parentId,
    body: c.body,
    anchor: c.anchor,
    status: c.status,
    resolvedNote: c.resolvedNote,
    resolvedBy: c.resolvedBy ? c.resolvedBy.name ?? c.resolvedBy.email : null,
    createdAt: c.createdAt.toISOString(),
    author: c.author,
  };
}

/** Comment on a round — on a storyboard field, or the round as a whole — or reply to
 *  a comment (replies inherit their parent's anchor; one level of threading). */
export async function addReviewComment(roundId: string, anchorRaw: unknown, body: string, parentId?: string | null) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not signed in." };
  const r = await getReviewRoundForUser(roundId);
  if (!r) return { error: "Review round not found." };
  if (!body || body.length > 20000) return { error: "Comment is empty or too long." };
  if (!extractText(body)) return { error: "Comment is empty." };

  let anchor = validateAnchor(anchorRaw);
  if (parentId) {
    const parent = await prisma.reviewComment.findFirst({
      where: { id: parentId, roundId },
      select: { parentId: true, anchor: true },
    });
    if (!parent) return { error: "That comment no longer exists." };
    if (parent.parentId) return { error: "Reply to the original comment, not a reply." };
    anchor = validateAnchor(parent.anchor) ?? anchor;
  }
  if (!anchor) return { error: "Invalid comment location." };

  const created = await prisma.reviewComment.create({
    data: { roundId, parentId: parentId ?? null, authorId: me.id, body, anchor },
    select: COMMENT_SELECT,
  });
  revalidatePath(`/reviews/${roundId}`);

  // @-mentions notify the people mentioned (members only — this is staff review).
  const ids = extractMentionIds(body).filter((id) => id !== me.id);
  if (ids.length && (await notificationsEnabled(r.deliverable.project.workspaceId, "mention"))) {
    const [people, deliverable] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: ids }, memberships: { some: { workspaceId: r.deliverable.project.workspaceId } } },
        select: { name: true, email: true },
      }),
      prisma.deliverable.findUnique({ where: { id: r.deliverableId }, select: { name: true, project: { select: { name: true } } } }),
    ]);
    const excerpt = extractText(body).slice(0, 280);
    for (const p of people) {
      if (!p.email) continue;
      await enqueueEmail({
        to: p.email,
        ...withLink(
          mentioned({
            recipientName: p.name ?? p.email,
            mentionerName: me.name ?? me.email,
            context: `a review comment (round ${r.number})`,
            cardTitle: deliverable?.name ?? "",
            boardName: deliverable?.project.name ?? "",
            excerpt,
          }),
          appUrl(`/reviews/${roundId}`),
        ),
      });
    }
  }

  return { comment: toDTO(created) };
}

/** Resolve / won't-fix / reopen a top-level comment, with an optional note the
 *  reviewer sees. */
export async function setReviewCommentStatus(commentId: string, status: string, note?: string | null) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not signed in." };
  const c = await getReviewCommentForUser(commentId);
  if (!c) return { error: "Comment not found." };
  if (c.parentId) return { error: "Only a thread's first comment has a status." };
  const parsed = z.enum(["open", "resolved", "wont_fix"]).safeParse(status);
  if (!parsed.success) return { error: "Invalid status." };
  const closing = parsed.data !== "open";
  const updated = await prisma.reviewComment.update({
    where: { id: commentId },
    data: {
      status: parsed.data,
      resolvedById: closing ? me.id : null,
      resolvedAt: closing ? new Date() : null,
      resolvedNote: closing ? (note?.trim() ? note.trim().slice(0, 1000) : null) : null,
    },
    select: COMMENT_SELECT,
  });
  revalidatePath(`/reviews/${c.roundId}`);
  return { comment: toDTO(updated) };
}

/** Delete your own comment (admins/managers can delete any). Deleting a thread's
 *  first comment removes its replies. */
export async function deleteReviewComment(commentId: string) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not signed in." };
  const c = await getReviewCommentForUser(commentId);
  if (!c) return { error: "Comment not found." };
  if (c.authorId !== me.id) {
    const round = await getReviewRoundForUser(c.roundId);
    if (!round || !(await isElevatedInWorkspace(round.deliverable.project.workspaceId))) {
      return { error: "You can only delete your own comments." };
    }
  }
  await prisma.reviewComment.delete({ where: { id: commentId } });
  revalidatePath(`/reviews/${c.roundId}`);
}
