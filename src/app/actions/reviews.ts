"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/dal";
import { getDeliverableForUser, getReviewForUser } from "@/lib/authz";
import { REVIEW_STATUSES } from "@/lib/methodology";
import { enqueueEmail } from "@/lib/queues";
import { reviewRequested, reviewDecided } from "@/lib/email-templates";

function fmtDate(d: Date | null): string | null {
  return d ? d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
}

function projectPath(projectId: string) {
  return `/projects/${projectId}`;
}

// Review changes surface in the personal "My Work" hub too — refresh the whole
// /my-work subtree (Overview + Review History), the project page, and the root
// layout (the header's "awaiting your review" notification badge).
function revalidateReview(projectId: string) {
  revalidatePath(projectPath(projectId));
  revalidatePath("/my-work", "layout");
  revalidatePath("/", "layout");
}

export async function addReviewCycle(deliverableId: string, reviewerId: string, dueIso: string | null) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not signed in." };
  const d = await getDeliverableForUser(deliverableId);
  if (!d) return { error: "Deliverable not found." };

  const project = await prisma.project.findUnique({ where: { id: d.projectId }, select: { workspaceId: true } });
  if (!project) return { error: "Project not found." };
  const member = await prisma.membership.findFirst({
    where: { userId: reviewerId, workspaceId: project.workspaceId },
    select: { id: true },
  });
  if (!member) return { error: "Reviewer must be a workspace member." };

  const dueDate = dueIso ? new Date(dueIso) : null;
  if (dueIso && Number.isNaN(dueDate!.getTime())) return { error: "Invalid date." };

  // Compute the next round number and insert atomically under Serializable
  // isolation, so two concurrent requests can't mint the same round.
  let review;
  try {
    review = await prisma.$transaction(
      async (tx) => {
        const last = await tx.reviewCycle.findFirst({
          where: { deliverableId },
          orderBy: { round: "desc" },
          select: { round: true },
        });
        return tx.reviewCycle.create({
          data: { deliverableId, reviewerId, requestedById: me.id, round: (last?.round ?? 0) + 1, dueDate },
          select: {
            id: true,
            round: true,
            reviewerId: true,
            status: true,
            dueDate: true,
            feedback: true,
            reviewer: { select: { id: true, name: true, email: true } },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch {
    return { error: "Couldn't start the review — please try again." };
  }
  revalidateReview(d.projectId);

  // Notify the reviewer (skip a self-review).
  if (review.reviewer.email && review.reviewerId !== me.id) {
    const meta = await prisma.deliverable.findUnique({
      where: { id: deliverableId },
      select: { name: true, project: { select: { name: true } } },
    });
    if (meta) {
      await enqueueEmail({
        to: review.reviewer.email,
        ...reviewRequested({
          reviewerName: review.reviewer.name ?? review.reviewer.email,
          deliverableName: meta.name,
          projectName: meta.project.name,
          requesterName: me.name ?? me.email,
          dueDate: fmtDate(review.dueDate),
        }),
      });
    }
  }

  return { review: { ...review, dueDate: review.dueDate ? review.dueDate.toISOString() : null } };
}

export async function setReviewStatus(reviewId: string, status: string) {
  const r = await getReviewForUser(reviewId);
  if (!r) return { error: "Review not found." };
  const parsed = z.enum(REVIEW_STATUSES).safeParse(status);
  if (!parsed.success) return { error: "Invalid status." };
  await prisma.reviewCycle.update({ where: { id: reviewId }, data: { status: parsed.data } });
  revalidateReview(r.deliverable.projectId);

  // A decision notifies whoever requested the review.
  if (parsed.data === "approved" || parsed.data === "changes_requested") {
    const me = await getCurrentUser();
    const detail = await prisma.reviewCycle.findUnique({
      where: { id: reviewId },
      select: {
        feedback: true,
        requestedBy: { select: { id: true, name: true, email: true } },
        reviewer: { select: { name: true, email: true } },
        deliverable: { select: { name: true, project: { select: { name: true } } } },
      },
    });
    if (detail?.requestedBy?.email && detail.requestedBy.id !== me?.id) {
      await enqueueEmail({
        to: detail.requestedBy.email,
        ...reviewDecided({
          requesterName: detail.requestedBy.name ?? detail.requestedBy.email,
          deliverableName: detail.deliverable.name,
          projectName: detail.deliverable.project.name,
          reviewerName: detail.reviewer.name ?? detail.reviewer.email,
          decision: parsed.data,
          feedback: detail.feedback,
        }),
      });
    }
  }
}

export async function setReviewFeedback(reviewId: string, feedback: string) {
  const r = await getReviewForUser(reviewId);
  if (!r) return { error: "Review not found." };
  await prisma.reviewCycle.update({
    where: { id: reviewId },
    data: { feedback: feedback.trim() ? feedback.slice(0, 5000) : null },
  });
  revalidateReview(r.deliverable.projectId);
}

export async function setReviewDue(reviewId: string, dueIso: string | null) {
  const r = await getReviewForUser(reviewId);
  if (!r) return { error: "Review not found." };
  const dueDate = dueIso ? new Date(dueIso) : null;
  if (dueIso && Number.isNaN(dueDate!.getTime())) return { error: "Invalid date." };
  await prisma.reviewCycle.update({ where: { id: reviewId }, data: { dueDate } });
  revalidateReview(r.deliverable.projectId);
}

export async function deleteReviewCycle(reviewId: string) {
  const r = await getReviewForUser(reviewId);
  if (!r) return { error: "Review not found." };
  await prisma.reviewCycle.delete({ where: { id: reviewId } });
  revalidateReview(r.deliverable.projectId);
}
