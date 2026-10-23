"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getActiveMembership, getCurrentUser } from "@/lib/dal";
import { getWhiteboardForUser, getStoryboardForUser, getCardForUser } from "@/lib/authz";
import { MAX_SCENE, SceneTooLarge, saveSceneFrom } from "@/lib/whiteboard-store";
import { parseScene, serializeScene } from "@/lib/whiteboard-scene";

const Title = z.string().trim().min(1, "Required").max(180);

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

/** Autosave: merge the browser's copy of the scene into the stored one. When someone
 *  else (another tab, or an assistant over MCP) wrote since `baseVersion`, the merged
 *  scene comes back so the browser can show their changes. */
export async function saveWhiteboardScene(id: string, scene: string, baseVersion: number) {
  const wb = await getWhiteboardForUser(id);
  if (!wb) return { error: "Whiteboard not found." };
  if (typeof scene !== "string" || scene.length > MAX_SCENE) return { error: "Scene too large." };
  try {
    const res = await saveSceneFrom(id, parseScene(scene));
    // No revalidate: the client holds the live scene; avoid churn on every autosave.
    return { version: res.version, scene: res.previousVersion !== baseVersion ? serializeScene(res.scene) : null };
  } catch (e) {
    if (e instanceof SceneTooLarge) return { error: "Scene too large." };
    throw e;
  }
}

/** Polled by an open whiteboard: the scene, if it changed after `version`. */
export async function getWhiteboardSceneSince(id: string, version: number) {
  const wb = await getWhiteboardForUser(id);
  if (!wb) return { error: "Whiteboard not found." };
  const row = await prisma.whiteboard.findUnique({ where: { id }, select: { scene: true, sceneVersion: true } });
  if (!row || row.sceneVersion === version) return { version, scene: null };
  return { version: row.sceneVersion, scene: row.scene };
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
  const card = await prisma.card.findUnique({ where: { id: cardId }, select: { title: true } });
  if (!card) redirect("/boards");
  const board = await prisma.board.findUnique({ where: { id: access.boardId }, select: { workspaceId: true } });
  if (!board) redirect("/boards");
  const whiteboard = await prisma.whiteboard.create({
    data: {
      workspaceId: board.workspaceId,
      cardId,
      createdById: me.id,
      title: `${card.title} — sketch`,
    },
    select: { id: true },
  });
  redirect(whiteboardPath(whiteboard.id));
}
