import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { Prisma, Role } from "@/generated/prisma/client";

// Resource-level authorization. A user may touch a board/column/card/project/etc.
// only if they are a member of the workspace that (transitively) owns it AND they
// pass the group-access check below. Each helper returns the resource (with the ids
// needed for revalidation) or null if absent/forbidden.

const ownedByUser = (userId: string) => ({ members: { some: { userId } } });

// Per-request access context, memoized for the render pass: which workspaces the
// user has blanket ("see everything") visibility into — ADMIN and MANAGER alike —
// and which groups they belong to.
const getAccessContext = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  const [memberships, groups] = await Promise.all([
    prisma.membership.findMany({ where: { userId: user.id }, select: { workspaceId: true, role: true } }),
    prisma.groupMembership.findMany({ where: { userId: user.id }, select: { groupId: true } }),
  ]);
  return {
    userId: user.id,
    elevatedWorkspaceIds: memberships
      .filter((m) => m.role === Role.ADMIN || m.role === Role.MANAGER)
      .map((m) => m.workspaceId),
    groupIds: groups.map((g) => g.groupId),
  };
});

type Ctx = NonNullable<Awaited<ReturnType<typeof getAccessContext>>>;

// Default-open access rule, expressed as a Prisma OR at the resource level: the
// resource is visible if the user administers its workspace, it has NO group
// grants (open to all members), or it's shared with a group the user is in.
function boardAccessOR(ctx: Ctx): Prisma.BoardWhereInput {
  return {
    OR: [
      { workspaceId: { in: ctx.elevatedWorkspaceIds } },
      { groupAccess: { none: {} } },
      { groupAccess: { some: { groupId: { in: ctx.groupIds } } } },
    ],
  };
}
function storyboardAccessOR(ctx: Ctx): Prisma.StoryboardWhereInput {
  return {
    OR: [
      { workspaceId: { in: ctx.elevatedWorkspaceIds } },
      { groupAccess: { none: {} } },
      { groupAccess: { some: { groupId: { in: ctx.groupIds } } } },
    ],
  };
}
function projectAccessOR(ctx: Ctx): Prisma.ProjectWhereInput {
  return {
    OR: [
      { workspaceId: { in: ctx.elevatedWorkspaceIds } },
      { groupAccess: { none: {} } },
      { groupAccess: { some: { groupId: { in: ctx.groupIds } } } },
    ],
  };
}
function whiteboardAccessOR(ctx: Ctx): Prisma.WhiteboardWhereInput {
  return {
    OR: [
      { workspaceId: { in: ctx.elevatedWorkspaceIds } },
      { groupAccess: { none: {} } },
      { groupAccess: { some: { groupId: { in: ctx.groupIds } } } },
    ],
  };
}

// Visibility `where` fragments for list/dashboard queries (which query Prisma
// directly instead of going through the getters). Spread alongside `workspaceId`.
export async function boardVisibilityWhere(): Promise<Prisma.BoardWhereInput> {
  const ctx = await getAccessContext();
  return ctx ? boardAccessOR(ctx) : { id: { in: [] } };
}
export async function storyboardVisibilityWhere(): Promise<Prisma.StoryboardWhereInput> {
  const ctx = await getAccessContext();
  return ctx ? storyboardAccessOR(ctx) : { id: { in: [] } };
}
export async function projectVisibilityWhere(): Promise<Prisma.ProjectWhereInput> {
  const ctx = await getAccessContext();
  return ctx ? projectAccessOR(ctx) : { id: { in: [] } };
}
export async function whiteboardVisibilityWhere(): Promise<Prisma.WhiteboardWhereInput> {
  const ctx = await getAccessContext();
  return ctx ? whiteboardAccessOR(ctx) : { id: { in: [] } };
}

// ── Boards ───────────────────────────────────────────────────────────────────

export async function getBoardForUser(boardId: string) {
  const ctx = await getAccessContext();
  if (!ctx) return null;
  return prisma.board.findFirst({
    where: { id: boardId, workspace: ownedByUser(ctx.userId), ...boardAccessOR(ctx) },
    select: { id: true, name: true, workspaceId: true, cardKeyPrefix: true },
  });
}

/** Resolve a card's short key ("WP-5") to its board + card, for the /c/[key]
 * short-link route. Prefix match is case-insensitive; access is the same
 * group-based visibility as everything else. */
export async function resolveCardKey(prefix: string, keySeq: number) {
  const ctx = await getAccessContext();
  if (!ctx) return null;
  const board = await prisma.board.findFirst({
    where: {
      cardKeyPrefix: { equals: prefix, mode: "insensitive" },
      workspace: ownedByUser(ctx.userId),
      ...boardAccessOR(ctx),
    },
    select: { id: true },
  });
  if (!board) return null;
  const card = await prisma.card.findFirst({
    where: {
      keySeq,
      OR: [
        { columnId: { not: null }, column: { boardId: board.id } },
        { parentCardId: { not: null }, parentCard: { column: { boardId: board.id } } },
      ],
    },
    select: { id: true, title: true, parentCardId: true },
  });
  if (!card) return null;
  return { boardId: board.id, cardId: card.id, title: card.title, isSubtask: card.parentCardId != null };
}

export async function getColumnForUser(columnId: string) {
  const ctx = await getAccessContext();
  if (!ctx) return null;
  return prisma.column.findFirst({
    where: { id: columnId, board: { workspace: ownedByUser(ctx.userId), ...boardAccessOR(ctx) } },
    select: { id: true, boardId: true, statusId: true },
  });
}

// A card's columnId is null when it's a subtask (see Card.parentCardId) — access
// resolves through the parent card's column instead, one hop only (subtasks can't
// nest further, so this never needs to recurse).
export async function getCardForUser(cardId: string) {
  const ctx = await getAccessContext();
  if (!ctx) return null;
  const card = await prisma.card.findFirst({
    where: {
      id: cardId,
      OR: [
        { column: { board: { workspace: ownedByUser(ctx.userId), ...boardAccessOR(ctx) } } },
        { parentCard: { column: { board: { workspace: ownedByUser(ctx.userId), ...boardAccessOR(ctx) } } } },
      ],
    },
    select: {
      id: true,
      columnId: true,
      parentCardId: true,
      column: { select: { boardId: true } },
      parentCard: { select: { column: { select: { boardId: true } } } },
    },
  });
  if (!card) return null;
  const boardId = card.column?.boardId ?? card.parentCard!.column!.boardId;
  return { id: card.id, columnId: card.columnId, parentCardId: card.parentCardId, boardId };
}

// ── Projects ─────────────────────────────────────────────────────────────────

export async function getProjectForUser(projectId: string) {
  const ctx = await getAccessContext();
  if (!ctx) return null;
  return prisma.project.findFirst({
    where: { id: projectId, workspace: ownedByUser(ctx.userId), ...projectAccessOR(ctx) },
    select: { id: true, name: true, workspaceId: true },
  });
}

export async function getPhaseForUser(phaseId: string) {
  const ctx = await getAccessContext();
  if (!ctx) return null;
  return prisma.phase.findFirst({
    where: { id: phaseId, project: { workspace: ownedByUser(ctx.userId), ...projectAccessOR(ctx) } },
    select: { id: true, projectId: true },
  });
}

// ── Intake ───────────────────────────────────────────────────────────────────
// No group-sharing concept here — triage is workspace-wide for every member,
// same as ReviewCycle — so this skips the xxxAccessOR step the other resources use.

export async function getIntakeRequestForUser(requestId: string) {
  const ctx = await getAccessContext();
  if (!ctx) return null;
  return prisma.intakeRequest.findFirst({
    where: { id: requestId, workspace: ownedByUser(ctx.userId) },
    include: { workspace: { select: { name: true } } },
  });
}

export async function intakeVisibilityWhere(): Promise<Prisma.IntakeRequestWhereInput> {
  const ctx = await getAccessContext();
  return ctx ? {} : { id: { in: [] } };
}

export async function getDeliverableForUser(deliverableId: string) {
  const ctx = await getAccessContext();
  if (!ctx) return null;
  return prisma.deliverable.findFirst({
    where: { id: deliverableId, project: { workspace: ownedByUser(ctx.userId), ...projectAccessOR(ctx) } },
    select: { id: true, projectId: true },
  });
}

export async function getMilestoneForUser(milestoneId: string) {
  const ctx = await getAccessContext();
  if (!ctx) return null;
  return prisma.milestone.findFirst({
    where: { id: milestoneId, project: { workspace: ownedByUser(ctx.userId), ...projectAccessOR(ctx) } },
    select: { id: true, projectId: true },
  });
}

export async function getReviewForUser(reviewId: string) {
  const ctx = await getAccessContext();
  if (!ctx) return null;
  return prisma.reviewCycle.findFirst({
    where: { id: reviewId, deliverable: { project: { workspace: ownedByUser(ctx.userId), ...projectAccessOR(ctx) } } },
    select: { id: true, deliverable: { select: { projectId: true } } },
  });
}

export async function getTimeEntryForUser(timeEntryId: string) {
  const ctx = await getAccessContext();
  if (!ctx) return null;
  return prisma.timeEntry.findFirst({
    where: { id: timeEntryId, project: { workspace: ownedByUser(ctx.userId), ...projectAccessOR(ctx) } },
    select: { id: true, projectId: true },
  });
}

export async function getObjectiveForUser(objectiveId: string) {
  const ctx = await getAccessContext();
  if (!ctx) return null;
  return prisma.learningObjective.findFirst({
    where: { id: objectiveId, project: { workspace: ownedByUser(ctx.userId), ...projectAccessOR(ctx) } },
    select: { id: true, projectId: true },
  });
}

export async function getAssessmentItemForUser(itemId: string) {
  const ctx = await getAccessContext();
  if (!ctx) return null;
  return prisma.assessmentItem.findFirst({
    where: { id: itemId, project: { workspace: ownedByUser(ctx.userId), ...projectAccessOR(ctx) } },
    select: { id: true, projectId: true },
  });
}

// ── Storyboards ──────────────────────────────────────────────────────────────

export async function getStoryboardForUser(storyboardId: string) {
  const ctx = await getAccessContext();
  if (!ctx) return null;
  return prisma.storyboard.findFirst({
    where: { id: storyboardId, workspace: ownedByUser(ctx.userId), ...storyboardAccessOR(ctx) },
    select: { id: true, workspaceId: true },
  });
}

export async function getScreenForUser(screenId: string) {
  const ctx = await getAccessContext();
  if (!ctx) return null;
  return prisma.screen.findFirst({
    where: { id: screenId, storyboard: { workspace: ownedByUser(ctx.userId), ...storyboardAccessOR(ctx) } },
    select: { id: true, storyboardId: true },
  });
}

// ── Whiteboards ──────────────────────────────────────────────────────────────

export async function getWhiteboardForUser(whiteboardId: string) {
  const ctx = await getAccessContext();
  if (!ctx) return null;
  return prisma.whiteboard.findFirst({
    where: { id: whiteboardId, workspace: ownedByUser(ctx.userId), ...whiteboardAccessOR(ctx) },
    select: { id: true, workspaceId: true },
  });
}
