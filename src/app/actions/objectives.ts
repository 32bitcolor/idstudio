"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  getProjectForUser,
  getObjectiveForUser,
  getAssessmentItemForUser,
  getScreenForUser,
} from "@/lib/authz";
import { positionBetween, positionForIndex } from "@/lib/ordering";
import { BLOOM_LEVELS, ASSESSMENT_ITEM_TYPES } from "@/lib/methodology";

function projectPath(projectId: string) {
  return `/projects/${projectId}`;
}

const Text = z.string().trim().min(1, "Required").max(500);
const Bloom = z.enum(BLOOM_LEVELS);
const ItemType = z.enum(ASSESSMENT_ITEM_TYPES);

// ── Learning objectives ───────────────────────────────────────────────────────

export async function createObjective(projectId: string, text: string, bloomLevel: string) {
  const project = await getProjectForUser(projectId);
  if (!project) return { error: "Project not found." };
  const t = Text.safeParse(text);
  const b = Bloom.safeParse(bloomLevel);
  if (!t.success) return { error: "Objective text is required." };
  if (!b.success) return { error: "Invalid level." };

  const last = await prisma.learningObjective.findFirst({
    where: { projectId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const objective = await prisma.learningObjective.create({
    data: { projectId, text: t.data, bloomLevel: b.data, position: positionBetween(last?.position ?? null, null) },
    select: { id: true, text: true, bloomLevel: true, position: true },
  });
  revalidatePath(projectPath(projectId));
  return { objective };
}

export async function setObjectiveText(id: string, text: string) {
  const o = await getObjectiveForUser(id);
  if (!o) return { error: "Objective not found." };
  const t = Text.safeParse(text);
  if (!t.success) return { error: "Objective text is required." };
  await prisma.learningObjective.update({ where: { id }, data: { text: t.data } });
  revalidatePath(projectPath(o.projectId));
}

export async function setObjectiveBloom(id: string, bloomLevel: string) {
  const o = await getObjectiveForUser(id);
  if (!o) return { error: "Objective not found." };
  const b = Bloom.safeParse(bloomLevel);
  if (!b.success) return { error: "Invalid level." };
  await prisma.learningObjective.update({ where: { id }, data: { bloomLevel: b.data } });
  revalidatePath(projectPath(o.projectId));
}

export async function moveObjective(id: string, targetIndex: number) {
  const o = await getObjectiveForUser(id);
  if (!o) return { error: "Objective not found." };
  const siblings = await prisma.learningObjective.findMany({
    where: { projectId: o.projectId, id: { not: id } },
    orderBy: { position: "asc" },
    select: { position: true },
  });
  const position = positionForIndex(siblings.map((s) => s.position), targetIndex);
  await prisma.learningObjective.update({ where: { id }, data: { position } });
  revalidatePath(projectPath(o.projectId));
}

export async function deleteObjective(id: string) {
  const o = await getObjectiveForUser(id);
  if (!o) return { error: "Objective not found." };
  await prisma.learningObjective.delete({ where: { id } });
  revalidatePath(projectPath(o.projectId));
}

// ── Screen ↔ objective threading ("this screen teaches …") ────────────────────

export async function toggleScreenObjective(screenId: string, objectiveId: string, on: boolean) {
  const screen = await getScreenForUser(screenId);
  if (!screen) return { error: "Screen not found." };
  const objective = await getObjectiveForUser(objectiveId);
  if (!objective) return { error: "Objective not found." };

  // The screen's storyboard must belong to the objective's project.
  const sb = await prisma.storyboard.findUnique({
    where: { id: screen.storyboardId },
    select: { deliverable: { select: { projectId: true } } },
  });
  if (sb?.deliverable?.projectId !== objective.projectId) {
    return { error: "That objective isn't part of this storyboard's project." };
  }

  if (on) {
    await prisma.screenObjective.upsert({
      where: { screenId_objectiveId: { screenId, objectiveId } },
      create: { screenId, objectiveId },
      update: {},
    });
  } else {
    await prisma.screenObjective.deleteMany({ where: { screenId, objectiveId } });
  }
  revalidatePath(projectPath(objective.projectId));
  return { ok: true };
}

// ── Assessment items ("this question assesses …") ─────────────────────────────

export async function createAssessmentItem(projectId: string, prompt: string, itemType: string) {
  const project = await getProjectForUser(projectId);
  if (!project) return { error: "Project not found." };
  const p = Text.safeParse(prompt);
  const t = ItemType.safeParse(itemType);
  if (!p.success) return { error: "A prompt is required." };
  if (!t.success) return { error: "Invalid type." };

  const last = await prisma.assessmentItem.findFirst({
    where: { projectId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const item = await prisma.assessmentItem.create({
    data: { projectId, prompt: p.data, itemType: t.data, position: positionBetween(last?.position ?? null, null) },
    select: { id: true, prompt: true, itemType: true, position: true },
  });
  revalidatePath(projectPath(projectId));
  return { item };
}

export async function setAssessmentItemPrompt(id: string, prompt: string) {
  const it = await getAssessmentItemForUser(id);
  if (!it) return { error: "Item not found." };
  const p = Text.safeParse(prompt);
  if (!p.success) return { error: "A prompt is required." };
  await prisma.assessmentItem.update({ where: { id }, data: { prompt: p.data } });
  revalidatePath(projectPath(it.projectId));
}

export async function setAssessmentItemType(id: string, itemType: string) {
  const it = await getAssessmentItemForUser(id);
  if (!it) return { error: "Item not found." };
  const t = ItemType.safeParse(itemType);
  if (!t.success) return { error: "Invalid type." };
  await prisma.assessmentItem.update({ where: { id }, data: { itemType: t.data } });
  revalidatePath(projectPath(it.projectId));
}

export async function deleteAssessmentItem(id: string) {
  const it = await getAssessmentItemForUser(id);
  if (!it) return { error: "Item not found." };
  await prisma.assessmentItem.delete({ where: { id } });
  revalidatePath(projectPath(it.projectId));
}

export async function toggleItemObjective(itemId: string, objectiveId: string, on: boolean) {
  const item = await getAssessmentItemForUser(itemId);
  if (!item) return { error: "Item not found." };
  const objective = await getObjectiveForUser(objectiveId);
  if (!objective || objective.projectId !== item.projectId) {
    return { error: "Objective not found." };
  }

  if (on) {
    await prisma.assessmentItemObjective.upsert({
      where: { itemId_objectiveId: { itemId, objectiveId } },
      create: { itemId, objectiveId },
      update: {},
    });
  } else {
    await prisma.assessmentItemObjective.deleteMany({ where: { itemId, objectiveId } });
  }
  revalidatePath(projectPath(item.projectId));
  return { ok: true };
}
