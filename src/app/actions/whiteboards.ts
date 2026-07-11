"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getActiveMembership, getCurrentUser } from "@/lib/dal";
import { getWhiteboardForUser, getStoryboardForUser, getCardForUser } from "@/lib/authz";

const Title = z.string().trim().min(1, "Required").max(180);
// Excalidraw scenes (with embedded image files) can get large; cap generously.
const MAX_SCENE = 8_000_000;

function whiteboardPath(id: string) {
  return `/whiteboards/${id}`;
}

export async function createWhiteboard(formData: FormData): Promise<void> {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");

  const title = Title.safeParse(formData.get("title"));
  if (!title.success) return;

  const whiteboard = await prisma.whiteboard.create({
    data: { workspaceId: membership.workspaceId, createdById: membership.userId, title: title.data },
    select: { id: true },
  });

  redirect(whiteboardPath(whiteboard.id));
}

export async function renameWhiteboard(id: string, title: string) {
  const wb = await getWhiteboardForUser(id);
  if (!wb) return { error: "Whiteboard not found." };
  const parsed = Title.safeParse(title);
  if (!parsed.success) return { error: "Title is required." };
  await prisma.whiteboard.update({ where: { id }, data: { title: parsed.data } });
  revalidatePath(whiteboardPath(id));
  revalidatePath("/whiteboards");
}

/** Autosave: persist the Excalidraw scene JSON (last-write-wins). */
export async function updateWhiteboardScene(id: string, scene: string) {
  const wb = await getWhiteboardForUser(id);
  if (!wb) return { error: "Whiteboard not found." };
  if (typeof scene !== "string" || scene.length > MAX_SCENE) return { error: "Scene too large." };
  await prisma.whiteboard.update({ where: { id }, data: { scene } });
  // No revalidate: the client holds the live scene; avoid churn on every autosave.
  return { ok: true };
}

/** Link (or unlink with null) the whiteboard to a storyboard the user can access. */
export async function setWhiteboardStoryboard(id: string, storyboardId: string | null) {
  const wb = await getWhiteboardForUser(id);
  if (!wb) return { error: "Whiteboard not found." };

  if (storyboardId) {
    const sb = await getStoryboardForUser(storyboardId);
    if (!sb || sb.workspaceId !== wb.workspaceId) return { error: "Storyboard not found." };
  }
  await prisma.whiteboard.update({ where: { id }, data: { storyboardId } });
  revalidatePath(whiteboardPath(id));
  revalidatePath("/whiteboards");
}

export async function deleteWhiteboard(id: string) {
  const wb = await getWhiteboardForUser(id);
  if (!wb) return { error: "Whiteboard not found." };
  await prisma.whiteboard.delete({ where: { id } });
  redirect("/whiteboards");
}

/** Create a whiteboard already linked to a storyboard (from the storyboard page). */
export async function createWhiteboardForStoryboard(storyboardId: string): Promise<void> {
  const me = await getCurrentUser();
  const sb = await getStoryboardForUser(storyboardId);
  if (!me || !sb) redirect("/storyboards");
  const storyboard = await prisma.storyboard.findUnique({
    where: { id: storyboardId },
    select: { title: true },
  });
  const whiteboard = await prisma.whiteboard.create({
    data: { workspaceId: sb.workspaceId, storyboardId, createdById: me.id, title: `${storyboard?.title ?? "Whiteboard"} — sketch` },
    select: { id: true },
  });
  redirect(whiteboardPath(whiteboard.id));
}

/** Create a whiteboard already linked to a board card (from the card drawer). */
export async function createWhiteboardForCard(cardId: string): Promise<void> {
  const me = await getCurrentUser();
  const access = await getCardForUser(cardId);
  if (!me || !access) redirect("/boards");
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { title: true, column: { select: { board: { select: { workspaceId: true } } } } },
  });
  if (!card) redirect("/boards");
  const whiteboard = await prisma.whiteboard.create({
    data: {
      workspaceId: card.column.board.workspaceId,
      cardId,
      createdById: me.id,
      title: `${card.title} — sketch`,
    },
    select: { id: true },
  });
  redirect(whiteboardPath(whiteboard.id));
}
