import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { validateAnchor } from "@/lib/review-anchor";
import { extractText } from "@/lib/mentions";

// Review comments as both audiences see them. Members and guests post through
// different server actions (different credentials), but the rules — anchors, one
// level of threading, size limits — and the wire shape are shared from here.

export type ReviewCommentDTO = {
  id: string;
  parentId: string | null;
  body: string;
  anchor: unknown;
  status: string;
  resolvedNote: string | null;
  resolvedBy: string | null;
  createdAt: string;
  /** null once the author's account (or guest link) is deleted. */
  author: { id: string; name: string; guest: boolean } | null;
};

/** Who's looking. Guests never get member email addresses — a member without a
 *  display name shows as "Team member". */
export type Audience = "member" | "guest";

export const COMMENT_SELECT = {
  id: true,
  parentId: true,
  body: true,
  anchor: true,
  status: true,
  resolvedNote: true,
  createdAt: true,
  resolvedBy: { select: { name: true, email: true } },
  author: { select: { id: true, name: true, email: true } },
  guest: { select: { id: true, name: true } },
} satisfies Prisma.ReviewCommentSelect;

type Row = Prisma.ReviewCommentGetPayload<{ select: typeof COMMENT_SELECT }>;

export function memberName(u: { name: string | null; email: string }, audience: Audience): string {
  return u.name ?? (audience === "guest" ? "Team member" : u.email);
}

export function toCommentDTO(c: Row, audience: Audience): ReviewCommentDTO {
  return {
    id: c.id,
    parentId: c.parentId,
    body: c.body,
    anchor: c.anchor,
    status: c.status,
    resolvedNote: c.resolvedNote,
    resolvedBy: c.resolvedBy ? memberName(c.resolvedBy, audience) : null,
    createdAt: c.createdAt.toISOString(),
    author: c.author
      ? { id: c.author.id, name: memberName(c.author, audience), guest: false }
      : c.guest
        ? { id: c.guest.id, name: c.guest.name, guest: true }
        : null,
  };
}

/** Validate and insert a comment or reply. Replies inherit their parent's anchor. */
export async function createRoundComment(input: {
  roundId: string;
  by: { authorId: string } | { guestId: string };
  anchor: unknown;
  body: string;
  parentId?: string | null;
}): Promise<{ row: Row } | { error: string }> {
  const { roundId, body, parentId } = input;
  if (!body || body.length > 20000) return { error: "Comment is empty or too long." };
  if (!extractText(body)) return { error: "Comment is empty." };

  let anchor = validateAnchor(input.anchor);
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

  const row = await prisma.reviewComment.create({
    data: { roundId, parentId: parentId ?? null, body, anchor, ...input.by },
    select: COMMENT_SELECT,
  });
  return { row };
}
