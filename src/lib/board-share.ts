import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/app-url";
import { toBlocks, type Block } from "@/lib/rich-text";

// Public, read-only board links. A link is /share/b/<boardId>-<mac>, where
// mac = HMAC-SHA256(SESSION_SECRET, boardId:nonce), the same scheme as guest review
// links (lib/review-guest-token.ts): only the random nonce is stored, so a database
// dump can't produce a link, and a new nonce kills the old one. No dot in the token,
// so the proxy still sees the path and sets its no-index headers.
//
// What a visitor sees is decided here and nowhere else: columns, and each top-level
// card that isn't private, with its title, key, labels, due date, subtask progress
// and description (mentions as plain names). Assignees only when the board opts in,
// by name, never email. Never comments, attachments, SMEs, reviews or whiteboards.

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set.");
  return s;
}

export function newShareNonce(): string {
  return randomBytes(24).toString("base64url");
}

function mac(boardId: string, nonce: string): string {
  return createHmac("sha256", secret()).update(`board-share:${boardId}:${nonce}`).digest("base64url");
}

export function shareToken(board: { id: string; publicNonce: string }): string {
  return `${board.id}-${mac(board.id, board.publicNonce)}`;
}

export function sharePath(board: { id: string; publicNonce: string }): string {
  return `/share/b/${shareToken(board)}`;
}

export function shareUrl(board: { id: string; publicNonce: string }): string {
  return appUrl(sharePath(board)) ?? sharePath(board);
}

function parseToken(token: string): { boardId: string } | null {
  // A cuid has no "-", so the first one splits the id from the MAC.
  const m = /^([a-z0-9]{20,40})-([A-Za-z0-9_-]{43})$/.exec(token);
  return m ? { boardId: m[1] } : null;
}

function matches(token: string, board: { id: string; publicNonce: string }): boolean {
  const expected = Buffer.from(shareToken(board));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export type PublicCard = {
  id: string;
  key: string | null;
  title: string;
  dueDate: string | null;
  labels: { id: string; name: string; color: string }[];
  assignees: string[];
  checklist: { total: number; done: number };
  description: Block[];
};
export type PublicColumn = { id: string; name: string; category: "todo" | "active" | "done" | null; cards: PublicCard[] };
export type PublicBoard = {
  name: string;
  workspaceName: string;
  showAssignees: boolean;
  updatedAt: string | null;
  columns: PublicColumn[];
};

/** The board a public link points at, already cut down to what a visitor may see;
 *  null when the link is wrong, reset, turned off, or the workspace disallows links. */
export async function loadPublicBoard(token: string): Promise<PublicBoard | null> {
  const parsed = parseToken(token);
  if (!parsed) return null;
  const board = await prisma.board.findUnique({
    where: { id: parsed.boardId },
    select: {
      id: true,
      name: true,
      publicNonce: true,
      publicShowAssignees: true,
      cardKeyPrefix: true,
      workspace: { select: { name: true, publicBoardsEnabled: true } },
    },
  });
  if (!board?.publicNonce || !board.workspace.publicBoardsEnabled) return null;
  if (!matches(token, { id: board.id, publicNonce: board.publicNonce })) return null;

  const columns = await prisma.column.findMany({
    where: { boardId: board.id },
    orderBy: { position: "asc" },
    select: {
      id: true,
      name: true,
      status: { select: { category: true } },
      cards: {
        where: { private: false },
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          dueDate: true,
          keySeq: true,
          updatedAt: true,
          labels: { select: { label: { select: { id: true, name: true, color: true } } } },
          assignees: { select: { user: { select: { name: true } } } },
          subtasks: { select: { done: true } },
        },
      },
    },
  });

  let latest = 0;
  const out: PublicColumn[] = columns.map((c) => ({
    id: c.id,
    name: c.name,
    category: (c.status?.category ?? null) as PublicColumn["category"],
    cards: c.cards.map((card) => {
      latest = Math.max(latest, card.updatedAt.getTime());
      return {
        id: card.id,
        key: board.cardKeyPrefix && card.keySeq != null ? `${board.cardKeyPrefix}-${card.keySeq}` : null,
        title: card.title,
        dueDate: card.dueDate ? card.dueDate.toISOString() : null,
        labels: card.labels.map((l) => l.label),
        // A member without a display name shows as "Team member", never their email.
        assignees: board.publicShowAssignees ? card.assignees.map((a) => a.user.name?.trim() || "Team member") : [],
        checklist: { total: card.subtasks.length, done: card.subtasks.filter((s) => s.done).length },
        description: toBlocks(card.description),
      };
    }),
  }));

  return {
    name: board.name,
    workspaceName: board.workspace.name,
    showAssignees: board.publicShowAssignees,
    updatedAt: latest ? new Date(latest).toISOString() : null,
    columns: out,
  };
}
