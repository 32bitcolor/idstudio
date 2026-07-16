"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { getBoardForUser, getCardForUser, whiteboardVisibilityWhere } from "@/lib/authz";
import { positionBetween } from "@/lib/ordering";
import { enqueueEmail } from "@/lib/queues";
import { subtaskAssigned } from "@/lib/email-templates";
import { nextCardKeySeq } from "@/app/actions/boards";

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid color");
const LabelName = z.string().trim().min(1).max(60);
const Title = z.string().trim().min(1).max(280);

function boardPath(boardId: string) {
  return `/boards/${boardId}`;
}

/** Full detail for the card drawer: the card, the board's labels, and the workspace members.
 * A subtask is just a Card with parentCardId set — this returns the identical shape for
 * either, plus isSubtask/parent so the drawer can show a "back to parent" link and hide
 * its own Subtasks section (nesting stops at one level). */
export async function getCardDetail(cardId: string) {
  const access = await getCardForUser(cardId);
  if (!access) return null;
  const boardId = access.boardId;

  const me = await getCurrentUser();
  if (!me) return null;

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { workspaceId: true, cardKeyPrefix: true },
  });
  if (!board) return null;

  const [card, boardLabels, members, membership, sprints] = await Promise.all([
    prisma.card.findUnique({
      where: { id: cardId },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        keySeq: true,
        sprintId: true,
        parentCardId: true,
        parentCard: { select: { id: true, title: true } },
        labels: { select: { labelId: true } },
        assignees: { select: { userId: true } },
        subtasks: {
          orderBy: { position: "asc" },
          select: {
            id: true, title: true, done: true, dueDate: true, keySeq: true,
            assignees: { select: { userId: true } },
            _count: { select: { comments: true, attachments: true } },
          },
        },
        comments: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            body: true,
            createdAt: true,
            author: { select: { id: true, name: true, email: true } },
          },
        },
        attachments: {
          orderBy: { createdAt: "asc" },
          select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
        },
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
    prisma.membership.findFirst({
      where: { userId: me.id, workspaceId: board.workspaceId },
      select: { role: true },
    }),
    prisma.sprint.findMany({
      where: { workspaceId: board.workspaceId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!card) return null;

  const whiteboards = await prisma.whiteboard.findMany({
    where: { cardId, ...(await whiteboardVisibilityWhere()) },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true },
  });

  return {
    boardId,
    boardCardKeyPrefix: board.cardKeyPrefix,
    card: {
      id: card.id,
      title: card.title,
      description: card.description,
      dueDate: card.dueDate ? card.dueDate.toISOString() : null,
      keySeq: card.keySeq,
      sprintId: card.sprintId,
      labelIds: card.labels.map((l) => l.labelId),
      assigneeIds: card.assignees.map((a) => a.userId),
    },
    isSubtask: card.parentCardId !== null,
    parent: card.parentCard,
    boardLabels,
    members,
    sprints,
    whiteboards,
    currentUserId: me.id,
    isAdmin: membership?.role === "ADMIN",
    subtasks: card.subtasks.map((s) => ({
      id: s.id,
      title: s.title,
      done: s.done,
      dueDate: s.dueDate ? s.dueDate.toISOString() : null,
      keySeq: s.keySeq,
      assigneeIds: s.assignees.map((a) => a.userId),
      commentCount: s._count.comments,
      attachmentCount: s._count.attachments,
    })),
    comments: card.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      author: c.author,
    })),
    attachments: card.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

export async function updateCardDescription(cardId: string, description: string | null) {
  const card = await getCardForUser(cardId);
  if (!card) return { error: "Card not found." };
  await prisma.card.update({
    where: { id: cardId },
    data: { description: description && description.trim() ? description : null },
  });
  revalidatePath(boardPath(card.boardId));
}

export async function setCardDueDate(cardId: string, iso: string | null) {
  const card = await getCardForUser(cardId);
  if (!card) return { error: "Card not found." };
  const dueDate = iso ? new Date(iso) : null;
  if (iso && Number.isNaN(dueDate!.getTime())) return { error: "Invalid date." };
  await prisma.card.update({ where: { id: cardId }, data: { dueDate } });
  revalidatePath(boardPath(card.boardId));
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
  const label = await prisma.label.findUnique({
    where: { id: labelId },
    select: { id: true, boardId: true },
  });
  // Group-aware board access, matching createLabel — not just workspace membership.
  if (!label || !(await getBoardForUser(label.boardId))) return { error: "Label not found." };
  await prisma.label.delete({ where: { id: labelId } });
  revalidatePath(boardPath(label.boardId));
}

export async function toggleCardLabel(cardId: string, labelId: string, on: boolean) {
  const card = await getCardForUser(cardId);
  if (!card) return { error: "Card not found." };
  // ensure the label belongs to the same board as the card
  const label = await prisma.label.findFirst({
    where: { id: labelId, boardId: card.boardId },
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
  revalidatePath(boardPath(card.boardId));
}

// ── Assignees ────────────────────────────────────────────────────────────────

export async function toggleCardAssignee(cardId: string, userId: string, on: boolean) {
  const card = await getCardForUser(cardId);
  if (!card) return { error: "Card not found." };

  const board = await prisma.board.findUnique({
    where: { id: card.boardId },
    select: { workspaceId: true, name: true },
  });
  if (!board) return { error: "Board not found." };

  // only workspace members may be assigned
  const member = await prisma.membership.findFirst({
    where: { userId, workspaceId: board.workspaceId },
    select: { id: true },
  });
  if (!member) return { error: "Not a workspace member." };

  const wasAssigned = await prisma.cardAssignee.findUnique({
    where: { cardId_userId: { cardId, userId } },
    select: { userId: true },
  });

  if (on) {
    await prisma.cardAssignee.upsert({
      where: { cardId_userId: { cardId, userId } },
      create: { cardId, userId },
      update: {},
    });
  } else {
    await prisma.cardAssignee.deleteMany({ where: { cardId, userId } });
  }

  // Only subtasks (cards with a parent) send an assignment email — nobody asked
  // for every top-level card assignment to email people, and that'd be noisy.
  if (on && !wasAssigned && card.parentCardId) {
    const [assignee, cardRow] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
      prisma.card.findUnique({ where: { id: cardId }, select: { title: true } }),
      ]);
    if (assignee && cardRow) {
      const parentCard = await prisma.card.findUnique({
        where: { id: card.parentCardId },
        select: { title: true },
      });
      await enqueueEmail({
        to: assignee.email,
        ...subtaskAssigned({
          assigneeName: assignee.name ?? assignee.email,
          subtaskText: cardRow.title,
          cardTitle: parentCard?.title ?? "",
          boardName: board.name,
        }),
      });
    }
  }

  revalidatePath(boardPath(card.boardId));
}

// ── Subtasks ─────────────────────────────────────────────────────────────────
// A subtask is a real Card with parentCardId set and columnId null — it gets
// comments, attachments, assignees, and labels for free via the same relations
// a top-level card already has. Nesting stops at one level: a card that's
// already a subtask never gets its own "Add a subtask" affordance.

export async function addSubtask(parentCardId: string, title: string) {
  const parent = await getCardForUser(parentCardId);
  if (!parent) return { error: "Card not found." };
  const parsed = Title.safeParse(title);
  if (!parsed.success) return { error: "Title is required." };

  const last = await prisma.card.findFirst({
    where: { parentCardId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const keySeq = await nextCardKeySeq(parent.boardId);
  const item = await prisma.card.create({
    data: { parentCardId, title: parsed.data, keySeq, position: positionBetween(last?.position ?? null, null) },
    select: { id: true, title: true, done: true, dueDate: true, keySeq: true },
  });
  revalidatePath(boardPath(parent.boardId));
  return {
    item: {
      id: item.id, title: item.title, done: item.done, keySeq: item.keySeq,
      dueDate: item.dueDate ? item.dueDate.toISOString() : null,
      assigneeIds: [] as string[], commentCount: 0, attachmentCount: 0,
    },
  };
}

export async function toggleSubtask(cardId: string, done: boolean) {
  const card = await getCardForUser(cardId);
  if (!card) return { error: "Item not found." };
  await prisma.card.update({ where: { id: cardId }, data: { done } });
  revalidatePath(boardPath(card.boardId));
}

export async function deleteSubtask(cardId: string) {
  const card = await getCardForUser(cardId);
  if (!card) return { error: "Item not found." };
  await prisma.card.delete({ where: { id: cardId } });
  revalidatePath(boardPath(card.boardId));
}

// ── Comments ─────────────────────────────────────────────────────────────────

export async function addComment(cardId: string, body: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized." };
  const card = await getCardForUser(cardId);
  if (!card) return { error: "Card not found." };
  const parsed = z.string().trim().min(1).max(5000).safeParse(body);
  if (!parsed.success) return { error: "Comment is empty." };

  const comment = await prisma.comment.create({
    data: { cardId, authorId: user.id, body: parsed.data },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, name: true, email: true } },
    },
  });
  revalidatePath(boardPath(card.boardId));
  return { comment: { ...comment, createdAt: comment.createdAt.toISOString() } };
}

export async function deleteComment(commentId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized." };
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, cardId: true },
  });
  const card = comment ? await getCardForUser(comment.cardId) : null;
  if (!comment || !card) return { error: "Comment not found." };

  const board = await prisma.board.findUnique({ where: { id: card.boardId }, select: { workspaceId: true } });
  let allowed = comment.authorId === user.id;
  if (!allowed && board) {
    const membership = await prisma.membership.findFirst({
      where: { userId: user.id, workspaceId: board.workspaceId },
      select: { role: true },
    });
    allowed = membership?.role === "ADMIN";
  }
  if (!allowed) return { error: "Not allowed." };

  await prisma.comment.delete({ where: { id: commentId } });
  revalidatePath(boardPath(card.boardId));
}
