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
// Card key prefix, e.g. "WP" -> cards are labeled "WP-1", "WP-2", ...
const CardKeyPrefix = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9]{1,7}$/, "2-8 letters/numbers, starting with a letter");

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

  // The prefix is optional — boards created without one just never label cards.
  const rawPrefix = formData.get("cardKeyPrefix");
  const prefixParsed = typeof rawPrefix === "string" && rawPrefix.trim() ? CardKeyPrefix.safeParse(rawPrefix) : null;
  let cardKeyPrefix: string | null = prefixParsed?.success ? prefixParsed.data : null;
  if (cardKeyPrefix) {
    const taken = await prisma.board.findFirst({
      where: { workspaceId: membership.workspaceId, cardKeyPrefix },
      select: { id: true },
    });
    // Another board already claimed it — the board still gets created, just
    // without a prefix (the raw create form has no field-error UI to explain
    // why; the board header's prefix editor does, so they can retry there).
    if (taken) cardKeyPrefix = null;
  }

  const positions = positionsAfter(null, DEFAULT_COLUMNS.length);
  const board = await prisma.board.create({
    data: {
      workspaceId: membership.workspaceId,
      name: parsed.data,
      cardKeyPrefix,
      columns: { create: DEFAULT_COLUMNS.map((name, i) => ({ name, position: positions[i] })) },
    },
    select: { id: true },
  });

  redirect(boardPath(board.id));
}

/** Set or clear a board's card-key prefix (blank clears it — existing card
 * keys are left as-is, only new cards stop getting one). Setting a prefix
 * retroactively assigns keys to any of the board's cards/subtasks that
 * don't have one yet (in creation order), so it isn't just new cards. */
export async function setBoardCardKeyPrefix(boardId: string, prefix: string) {
  const board = await getBoardForUser(boardId);
  if (!board) return { error: "Board not found." };
  if (!prefix.trim()) {
    await prisma.board.update({ where: { id: boardId }, data: { cardKeyPrefix: null } });
    revalidatePath(boardPath(boardId));
    return { cardKeyPrefix: null };
  }
  const parsed = CardKeyPrefix.safeParse(prefix);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid prefix." };

  if (parsed.data !== board.cardKeyPrefix) {
    const taken = await prisma.board.findFirst({
      where: { workspaceId: board.workspaceId, cardKeyPrefix: parsed.data, id: { not: boardId } },
      select: { id: true },
    });
    if (taken) return { error: `"${parsed.data}" is already used by another board in this workspace.` };
  }

  await prisma.board.update({ where: { id: boardId }, data: { cardKeyPrefix: parsed.data } });
  await backfillCardKeys(boardId);
  revalidatePath(boardPath(boardId));
  return { cardKeyPrefix: parsed.data };
}

/** Assign keys to any of a board's cards/subtasks that don't have one yet
 * (creation order), so setting a prefix on a board that already has cards
 * labels them immediately instead of only labeling cards created after. */
async function backfillCardKeys(boardId: string) {
  const cards = await prisma.card.findMany({
    where: {
      keySeq: null,
      OR: [
        { columnId: { not: null }, column: { boardId } },
        { parentCardId: { not: null }, parentCard: { column: { boardId } } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (cards.length === 0) return;

  await prisma.$transaction(async (tx) => {
    const current = await tx.board.findUniqueOrThrow({ where: { id: boardId }, select: { cardKeySeq: true } });
    let seq = current.cardKeySeq;
    for (const c of cards) {
      seq += 1;
      await tx.card.update({ where: { id: c.id }, data: { keySeq: seq } });
    }
    await tx.board.update({ where: { id: boardId }, data: { cardKeySeq: seq } });
  });
}

/** Claim the next card key number for a board, or null if it has no prefix
 * set (checked first so boards without a prefix never burn through the
 * sequence — otherwise adding a prefix later would start mid-way instead of
 * at 1). The increment itself is a single atomic UPDATE, safe under
 * concurrent card creation. Shared by top-level cards and subtasks alike. */
export async function nextCardKeySeq(boardId: string): Promise<number | null> {
  const board = await prisma.board.findUnique({ where: { id: boardId }, select: { cardKeyPrefix: true } });
  if (!board?.cardKeyPrefix) return null;
  const updated = await prisma.board.update({
    where: { id: boardId },
    data: { cardKeySeq: { increment: 1 } },
    select: { cardKeySeq: true },
  });
  return updated.cardKeySeq;
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
  const keySeq = await nextCardKeySeq(column.boardId);
  const card = await prisma.card.create({
    data: { columnId, title: parsed.data, keySeq, position: positionBetween(last?.position ?? null, null) },
    select: { id: true, columnId: true, title: true, description: true, position: true, keySeq: true },
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
  revalidatePath(boardPath(card.boardId));
}

export async function deleteCard(cardId: string) {
  const card = await getCardForUser(cardId);
  if (!card) return { error: "Card not found." };
  await prisma.card.delete({ where: { id: cardId } });
  revalidatePath(boardPath(card.boardId));
}

/** Move a card to `toColumnId` at `targetIndex` (index among the OTHER cards there). */
export async function moveCard(cardId: string, toColumnId: string, targetIndex: number) {
  const card = await getCardForUser(cardId);
  if (!card) return { error: "Card not found." };
  const target = await getColumnForUser(toColumnId);
  if (!target) return { error: "Target column not found." };
  if (target.boardId !== card.boardId) return { error: "Cross-board move not allowed." };

  const siblings = await prisma.card.findMany({
    where: { columnId: toColumnId, id: { not: cardId } },
    orderBy: { position: "asc" },
    select: { position: true },
  });
  const position = positionForIndex(siblings.map((c) => c.position), targetIndex);
  await prisma.card.update({ where: { id: cardId }, data: { columnId: toColumnId, position } });
  revalidatePath(boardPath(card.boardId));
}
