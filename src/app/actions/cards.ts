"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { getBoardForUser, getCardForUser } from "@/lib/authz";

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid color");
const LabelName = z.string().trim().min(1).max(60);

function boardPath(boardId: string) {
  return `/boards/${boardId}`;
}

/** Full detail for the card drawer: the card, the board's labels, and the workspace members. */
export async function getCardDetail(cardId: string) {
  const access = await getCardForUser(cardId);
  if (!access) return null;
  const boardId = access.column.boardId;

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { workspaceId: true },
  });
  if (!board) return null;

  const [card, boardLabels, members] = await Promise.all([
    prisma.card.findUnique({
      where: { id: cardId },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        labels: { select: { labelId: true } },
        assignees: { select: { userId: true } },
      },
    }),
    prisma.label.findMany({
      where: { boardId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.user.findMany({
      where: { memberships: { some: { workspaceId: board.workspaceId } } },
      orderBy: { email: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);
  if (!card) return null;

  return {
    boardId,
    card: {
      id: card.id,
      title: card.title,
      description: card.description,
      dueDate: card.dueDate ? card.dueDate.toISOString() : null,
      labelIds: card.labels.map((l) => l.labelId),
      assigneeIds: card.assignees.map((a) => a.userId),
    },
    boardLabels,
    members,
  };
}

export async function updateCardDescription(cardId: string, description: string | null) {
  const card = await getCardForUser(cardId);
  if (!card) return { error: "Card not found." };
  await prisma.card.update({
    where: { id: cardId },
    data: { description: description && description.trim() ? description : null },
  });
  revalidatePath(boardPath(card.column.boardId));
}

export async function setCardDueDate(cardId: string, iso: string | null) {
  const card = await getCardForUser(cardId);
  if (!card) return { error: "Card not found." };
  const dueDate = iso ? new Date(iso) : null;
  if (iso && Number.isNaN(dueDate!.getTime())) return { error: "Invalid date." };
  await prisma.card.update({ where: { id: cardId }, data: { dueDate } });
  revalidatePath(boardPath(card.column.boardId));
}

// ── Labels ───────────────────────────────────────────────────────────────────

export async function createLabel(boardId: string, name: string, color: string) {
  const board = await getBoardForUser(boardId);
  if (!board) return { error: "Board not found." };
  const n = LabelName.safeParse(name);
  const c = Hex.safeParse(color);
  if (!n.success || !c.success) return { error: "Invalid label." };
  const label = await prisma.label.create({
    data: { boardId, name: n.data, color: c.data },
    select: { id: true, name: true, color: true },
  });
  revalidatePath(boardPath(boardId));
  return { label };
}

export async function deleteLabel(labelId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized." };
  const label = await prisma.label.findFirst({
    where: { id: labelId, board: { workspace: { members: { some: { userId: user.id } } } } },
    select: { id: true, boardId: true },
  });
  if (!label) return { error: "Label not found." };
  await prisma.label.delete({ where: { id: labelId } });
  revalidatePath(boardPath(label.boardId));
}

export async function toggleCardLabel(cardId: string, labelId: string, on: boolean) {
  const card = await getCardForUser(cardId);
  if (!card) return { error: "Card not found." };
  // ensure the label belongs to the same board as the card
  const label = await prisma.label.findFirst({
    where: { id: labelId, boardId: card.column.boardId },
    select: { id: true },
  });
  if (!label) return { error: "Label not found." };

  if (on) {
    await prisma.cardLabel.upsert({
      where: { cardId_labelId: { cardId, labelId } },
      create: { cardId, labelId },
      update: {},
    });
  } else {
    await prisma.cardLabel.deleteMany({ where: { cardId, labelId } });
  }
  revalidatePath(boardPath(card.column.boardId));
}

// ── Assignees ────────────────────────────────────────────────────────────────

export async function toggleCardAssignee(cardId: string, userId: string, on: boolean) {
  const card = await getCardForUser(cardId);
  if (!card) return { error: "Card not found." };

  const board = await prisma.board.findUnique({
    where: { id: card.column.boardId },
    select: { workspaceId: true },
  });
  if (!board) return { error: "Board not found." };

  // only workspace members may be assigned
  const member = await prisma.membership.findFirst({
    where: { userId, workspaceId: board.workspaceId },
    select: { id: true },
  });
  if (!member) return { error: "Not a workspace member." };

  if (on) {
    await prisma.cardAssignee.upsert({
      where: { cardId_userId: { cardId, userId } },
      create: { cardId, userId },
      update: {},
    });
  } else {
    await prisma.cardAssignee.deleteMany({ where: { cardId, userId } });
  }
  revalidatePath(boardPath(card.column.boardId));
}
