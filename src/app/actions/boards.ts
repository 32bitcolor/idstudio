"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { getBoardForUser, getColumnForUser, getCardForUser } from "@/lib/authz";
import { positionBetween, positionsAfter, positionForIndex } from "@/lib/ordering";

const Name = z.string().trim().min(1, "Required").max(120);
const Title = z.string().trim().min(1, "Required").max(280);

const DEFAULT_COLUMNS = ["To do", "In progress", "Done"];

function boardPath(boardId: string) {
  return `/boards/${boardId}`;
}

// ── Boards ───────────────────────────────────────────────────────────────────

export async function createBoard(formData: FormData): Promise<void> {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");

  const parsed = Name.safeParse(formData.get("name"));
  if (!parsed.success) return; // the input is `required`; empty names are a no-op

  const positions = positionsAfter(null, DEFAULT_COLUMNS.length);
  const board = await prisma.board.create({
    data: {
      workspaceId: membership.workspaceId,
      name: parsed.data,
      columns: { create: DEFAULT_COLUMNS.map((name, i) => ({ name, position: positions[i] })) },
    },
    select: { id: true },
  });

  redirect(boardPath(board.id));
}

export async function renameBoard(boardId: string, name: string) {
  const board = await getBoardForUser(boardId);
  if (!board) return { error: "Board not found." };
  const parsed = Name.safeParse(name);
  if (!parsed.success) return { error: "Board name is required." };
  await prisma.board.update({ where: { id: boardId }, data: { name: parsed.data } });
  revalidatePath(boardPath(boardId));
  revalidatePath("/boards");
}

export async function deleteBoard(boardId: string) {
  const board = await getBoardForUser(boardId);
  if (!board) return { error: "Board not found." };
  await prisma.board.delete({ where: { id: boardId } });
  redirect("/boards");
}

// ── Columns ──────────────────────────────────────────────────────────────────

export async function createColumn(boardId: string, name: string) {
  const board = await getBoardForUser(boardId);
  if (!board) return { error: "Board not found." };
  const parsed = Name.safeParse(name);
  if (!parsed.success) return { error: "Column name is required." };

  const last = await prisma.column.findFirst({
    where: { boardId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const column = await prisma.column.create({
    data: { boardId, name: parsed.data, position: positionBetween(last?.position ?? null, null) },
    select: { id: true, name: true, position: true },
  });
  revalidatePath(boardPath(boardId));
  return { column };
}

export async function renameColumn(columnId: string, name: string) {
  const column = await getColumnForUser(columnId);
  if (!column) return { error: "Column not found." };
  const parsed = Name.safeParse(name);
  if (!parsed.success) return { error: "Column name is required." };
  await prisma.column.update({ where: { id: columnId }, data: { name: parsed.data } });
  revalidatePath(boardPath(column.boardId));
}

export async function deleteColumn(columnId: string) {
  const column = await getColumnForUser(columnId);
  if (!column) return { error: "Column not found." };
  await prisma.column.delete({ where: { id: columnId } });
  revalidatePath(boardPath(column.boardId));
}

export async function moveColumn(columnId: string, targetIndex: number) {
  const column = await getColumnForUser(columnId);
  if (!column) return { error: "Column not found." };

  const siblings = await prisma.column.findMany({
    where: { boardId: column.boardId, id: { not: columnId } },
    orderBy: { position: "asc" },
    select: { position: true },
  });
  const position = positionForIndex(siblings.map((c) => c.position), targetIndex);
  await prisma.column.update({ where: { id: columnId }, data: { position } });
  revalidatePath(boardPath(column.boardId));
}

// ── Cards ────────────────────────────────────────────────────────────────────

export async function createCard(columnId: string, title: string) {
  const column = await getColumnForUser(columnId);
  if (!column) return { error: "Column not found." };
  const parsed = Title.safeParse(title);
  if (!parsed.success) return { error: "Card title is required." };

  const last = await prisma.card.findFirst({
    where: { columnId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const card = await prisma.card.create({
    data: { columnId, title: parsed.data, position: positionBetween(last?.position ?? null, null) },
    select: { id: true, columnId: true, title: true, description: true, position: true },
  });
  revalidatePath(boardPath(column.boardId));
  return { card };
}

export async function renameCard(cardId: string, title: string) {
  const card = await getCardForUser(cardId);
  if (!card) return { error: "Card not found." };
  const parsed = Title.safeParse(title);
  if (!parsed.success) return { error: "Card title is required." };
  await prisma.card.update({ where: { id: cardId }, data: { title: parsed.data } });
  revalidatePath(boardPath(card.column.boardId));
}

export async function deleteCard(cardId: string) {
  const card = await getCardForUser(cardId);
  if (!card) return { error: "Card not found." };
  await prisma.card.delete({ where: { id: cardId } });
  revalidatePath(boardPath(card.column.boardId));
}

/** Move a card to `toColumnId` at `targetIndex` (index among the OTHER cards there). */
export async function moveCard(cardId: string, toColumnId: string, targetIndex: number) {
  const card = await getCardForUser(cardId);
  if (!card) return { error: "Card not found." };
  const target = await getColumnForUser(toColumnId);
  if (!target) return { error: "Target column not found." };
  if (target.boardId !== card.column.boardId) return { error: "Cross-board move not allowed." };

  const siblings = await prisma.card.findMany({
    where: { columnId: toColumnId, id: { not: cardId } },
    orderBy: { position: "asc" },
    select: { position: true },
  });
  const position = positionForIndex(siblings.map((c) => c.position), targetIndex);
  await prisma.card.update({ where: { id: cardId }, data: { columnId: toColumnId, position } });
  revalidatePath(boardPath(card.column.boardId));
}
