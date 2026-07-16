"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { getCardForUser } from "@/lib/authz";
import { deleteObject } from "@/lib/storage";

// Upload + download stream through the app's own API routes
// (src/app/api/attachments/*) so file traffic stays on the app's HTTPS origin
// rather than hitting a presigned MinIO URL the browser may not reach.

function boardPath(boardId: string) {
  return `/boards/${boardId}`;
}

export async function deleteAttachment(attachmentId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized." };
  const att = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    select: { id: true, storageKey: true, cardId: true },
  });
  const card = att ? await getCardForUser(att.cardId) : null;
  if (!att || !card) return { error: "Not found." };
  await deleteObject(att.storageKey);
  await prisma.attachment.delete({ where: { id: attachmentId } });
  revalidatePath(boardPath(card.boardId));
}
