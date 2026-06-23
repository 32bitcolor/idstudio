"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { getStoryboardForUser } from "@/lib/authz";
import { STORYBOARD_STATUSES } from "@/lib/storyboard";

const Title = z.string().trim().min(1, "Required").max(180);

function storyboardPath(storyboardId: string) {
  return `/storyboards/${storyboardId}`;
}

// ── Storyboards ──────────────────────────────────────────────────────────────

export async function createStoryboard(formData: FormData): Promise<void> {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");

  const title = Title.safeParse(formData.get("title"));
  if (!title.success) return;

  const storyboard = await prisma.storyboard.create({
    data: { workspaceId: membership.workspaceId, title: title.data },
    select: { id: true },
  });

  redirect(storyboardPath(storyboard.id));
}

export async function renameStoryboard(storyboardId: string, title: string) {
  const sb = await getStoryboardForUser(storyboardId);
  if (!sb) return { error: "Storyboard not found." };
  const parsed = Title.safeParse(title);
  if (!parsed.success) return { error: "Title is required." };
  await prisma.storyboard.update({ where: { id: storyboardId }, data: { title: parsed.data } });
  revalidatePath(storyboardPath(storyboardId));
  revalidatePath("/storyboards");
}

export async function updateStoryboardDescription(storyboardId: string, description: string) {
  const sb = await getStoryboardForUser(storyboardId);
  if (!sb) return { error: "Storyboard not found." };
  await prisma.storyboard.update({
    where: { id: storyboardId },
    data: { description: description.trim() ? description.trim().slice(0, 2000) : null },
  });
  revalidatePath(storyboardPath(storyboardId));
}

export async function setStoryboardStatus(storyboardId: string, status: string) {
  const sb = await getStoryboardForUser(storyboardId);
  if (!sb) return { error: "Storyboard not found." };
  const parsed = z.enum(STORYBOARD_STATUSES).safeParse(status);
  if (!parsed.success) return { error: "Invalid status." };
  await prisma.storyboard.update({ where: { id: storyboardId }, data: { status: parsed.data } });
  revalidatePath(storyboardPath(storyboardId));
  revalidatePath("/storyboards");
}

export async function deleteStoryboard(storyboardId: string) {
  const sb = await getStoryboardForUser(storyboardId);
  if (!sb) return { error: "Storyboard not found." };
  await prisma.storyboard.delete({ where: { id: storyboardId } });
  redirect("/storyboards");
}
