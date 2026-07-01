"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { getDeliverableForUser, getReviewForUser } from "@/lib/authz";
import { REVIEW_STATUSES } from "@/lib/methodology";

function projectPath(projectId: string) {
  return `/projects/${projectId}`;
}

// Review changes surface in the personal "My Work" hub too, so refresh both.
function revalidateReview(projectId: string) {
  revalidatePath(projectPath(projectId));
  revalidatePath("/my-work");
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

  const last = await prisma.reviewCycle.findFirst({
    where: { deliverableId },
    orderBy: { round: "desc" },
    select: { round: true },
  });
  const review = await prisma.reviewCycle.create({
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
  revalidateReview(d.projectId);
  return { review: { ...review, dueDate: review.dueDate ? review.dueDate.toISOString() : null } };
}

export async function setReviewStatus(reviewId: string, status: string) {
  const r = await getReviewForUser(reviewId);
  if (!r) return { error: "Review not found." };
  const parsed = z.enum(REVIEW_STATUSES).safeParse(status);
  if (!parsed.success) return { error: "Invalid status." };
  await prisma.reviewCycle.update({ where: { id: reviewId }, data: { status: parsed.data } });
  revalidateReview(r.deliverable.projectId);
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
