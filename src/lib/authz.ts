import "server-only";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";

// Resource-level authorization: a user may touch a board/column/card only if they
// are a member of the workspace that (transitively) owns it. Each helper returns
// the resource (with the ids needed for revalidation) or null if absent/forbidden.

const ownedByUser = (userId: string) => ({ members: { some: { userId } } });

export async function getBoardForUser(boardId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return prisma.board.findFirst({
    where: { id: boardId, workspace: ownedByUser(user.id) },
    select: { id: true, name: true, workspaceId: true },
  });
}

export async function getColumnForUser(columnId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return prisma.column.findFirst({
    where: { id: columnId, board: { workspace: ownedByUser(user.id) } },
    select: { id: true, boardId: true },
  });
}

export async function getCardForUser(cardId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return prisma.card.findFirst({
    where: { id: cardId, column: { board: { workspace: ownedByUser(user.id) } } },
    select: { id: true, columnId: true, column: { select: { boardId: true } } },
  });
}

export async function getProjectForUser(projectId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return prisma.project.findFirst({
    where: { id: projectId, workspace: ownedByUser(user.id) },
    select: { id: true, name: true, workspaceId: true },
  });
}

export async function getPhaseForUser(phaseId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return prisma.phase.findFirst({
    where: { id: phaseId, project: { workspace: ownedByUser(user.id) } },
    select: { id: true, projectId: true },
  });
}

export async function getDeliverableForUser(deliverableId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return prisma.deliverable.findFirst({
    where: { id: deliverableId, project: { workspace: ownedByUser(user.id) } },
    select: { id: true, projectId: true },
  });
}

export async function getMilestoneForUser(milestoneId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return prisma.milestone.findFirst({
    where: { id: milestoneId, project: { workspace: ownedByUser(user.id) } },
    select: { id: true, projectId: true },
  });
}

export async function getReviewForUser(reviewId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return prisma.reviewCycle.findFirst({
    where: { id: reviewId, deliverable: { project: { workspace: ownedByUser(user.id) } } },
    select: { id: true, deliverable: { select: { projectId: true } } },
  });
}

export async function getTimeEntryForUser(timeEntryId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return prisma.timeEntry.findFirst({
    where: { id: timeEntryId, project: { workspace: ownedByUser(user.id) } },
    select: { id: true, projectId: true },
  });
}
