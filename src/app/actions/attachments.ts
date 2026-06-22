"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { getCardForUser } from "@/lib/authz";
import {
  buildObjectKey,
  presignUpload,
  presignDownload,
  deleteObject,
  MAX_UPLOAD_BYTES,
} from "@/lib/storage";

function boardPath(boardId: string) {
  return `/boards/${boardId}`;
}

async function cardWorkspace(cardId: string) {
  const card = await getCardForUser(cardId);
  if (!card) return null;
  const board = await prisma.board.findUnique({
    where: { id: card.column.boardId },
    select: { id: true, workspaceId: true },
  });
  return board ? { boardId: board.id, workspaceId: board.workspaceId } : null;
}

const memberFilter = (userId: string) => ({
  card: { column: { board: { workspace: { members: { some: { userId } } } } } },
});

/** Step 1: validate + return a presigned PUT URL the browser uploads to directly. */
export async function requestUpload(
  cardId: string,
  fileName: string,
  mimeType: string,
  sizeBytes: number,
) {
  const ws = await cardWorkspace(cardId);
  if (!ws) return { error: "Card not found." };
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return { error: "Invalid file." };
  if (sizeBytes > MAX_UPLOAD_BYTES) return { error: "File exceeds the 25 MB limit." };
  const name = z.string().trim().min(1).max(255).safeParse(fileName);
  if (!name.success) return { error: "Invalid file name." };

  const contentType = mimeType || "application/octet-stream";
  const key = buildObjectKey(ws.workspaceId, cardId, name.data);
  const uploadUrl = await presignUpload(key, contentType);
  return { uploadUrl, key, contentType };
}

/** Step 2: after the browser PUT succeeds, record the attachment. */
export async function finalizeUpload(
  cardId: string,
  key: string,
  fileName: string,
  mimeType: string,
  sizeBytes: number,
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized." };
  const ws = await cardWorkspace(cardId);
  if (!ws) return { error: "Card not found." };
  // The key must live under this card's path — stops registering arbitrary objects.
  if (!key.startsWith(`workspace/${ws.workspaceId}/card/${cardId}/`)) return { error: "Invalid key." };
  if (sizeBytes > MAX_UPLOAD_BYTES) return { error: "File too large." };

  const att = await prisma.attachment.create({
    data: {
      cardId,
      workspaceId: ws.workspaceId,
      fileName: fileName.slice(0, 255),
      mimeType: mimeType || "application/octet-stream",
      sizeBytes: Math.max(0, Math.floor(sizeBytes)),
      storageKey: key,
      uploadedById: user.id,
    },
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
  });
  revalidatePath(boardPath(ws.boardId));
  return { attachment: { ...att, createdAt: att.createdAt.toISOString() } };
}

export async function getDownloadUrl(attachmentId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized." };
  const att = await prisma.attachment.findFirst({
    where: { id: attachmentId, ...memberFilter(user.id) },
    select: { storageKey: true, fileName: true },
  });
  if (!att) return { error: "Not found." };
  return { url: await presignDownload(att.storageKey, att.fileName) };
}

export async function deleteAttachment(attachmentId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized." };
  const att = await prisma.attachment.findFirst({
    where: { id: attachmentId, ...memberFilter(user.id) },
    select: { id: true, storageKey: true, card: { select: { column: { select: { boardId: true } } } } },
  });
  if (!att) return { error: "Not found." };
  await deleteObject(att.storageKey);
  await prisma.attachment.delete({ where: { id: attachmentId } });
  revalidatePath(boardPath(att.card.column.boardId));
}
