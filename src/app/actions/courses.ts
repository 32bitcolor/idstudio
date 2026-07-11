"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import {
  getCourseForUser,
  getLessonForUser,
  getBlockForUser,
  getDeliverableForUser,
} from "@/lib/authz";
import { positionBetween, positionForIndex } from "@/lib/ordering";
import { BLOCK_TYPES, defaultBlockContent, parseBlockContent, type BlockType, type ImageContent } from "@/lib/course";
import {
  buildCourseImageKey,
  presignUpload,
  presignView,
  deleteObject,
  MAX_UPLOAD_BYTES,
} from "@/lib/storage";

const Title = z.string().trim().min(1, "Required").max(200);
const LessonTitle = z.string().trim().min(1, "Required").max(200);
const BlockTypeE = z.enum(BLOCK_TYPES);

function coursePath(courseId: string) {
  return `/courses/${courseId}`;
}

// ── Courses ──────────────────────────────────────────────────────────────────

export async function createCourse(formData: FormData): Promise<void> {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");
  const title = Title.safeParse(formData.get("title"));
  if (!title.success) return;

  const course = await prisma.course.create({
    data: { workspaceId: membership.workspaceId, title: title.data },
    select: { id: true },
  });
  // Every course starts with one lesson so the editor isn't empty.
  await prisma.lesson.create({
    data: { courseId: course.id, title: "Lesson 1", position: positionBetween(null, null) },
  });
  redirect(coursePath(course.id));
}

export async function createCourseForDeliverable(deliverableId: string) {
  const access = await getDeliverableForUser(deliverableId);
  if (!access) return { error: "Deliverable not found." };
  const deliverable = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    select: {
      name: true,
      project: { select: { workspaceId: true } },
      course: { select: { id: true, title: true } },
    },
  });
  if (!deliverable) return { error: "Deliverable not found." };
  if (deliverable.course) return { course: deliverable.course };

  const course = await prisma.course.create({
    data: { workspaceId: deliverable.project.workspaceId, deliverableId, title: deliverable.name },
    select: { id: true, title: true },
  });
  await prisma.lesson.create({
    data: { courseId: course.id, title: "Lesson 1", position: positionBetween(null, null) },
  });
  revalidatePath(`/projects/${access.projectId}`);
  revalidatePath("/courses");
  return { course };
}

export async function renameCourse(courseId: string, title: string) {
  const c = await getCourseForUser(courseId);
  if (!c) return { error: "Course not found." };
  const parsed = Title.safeParse(title);
  if (!parsed.success) return { error: "Title is required." };
  await prisma.course.update({ where: { id: courseId }, data: { title: parsed.data } });
  revalidatePath(coursePath(courseId));
  revalidatePath("/courses");
}

export async function setCourseDescription(courseId: string, description: string) {
  const c = await getCourseForUser(courseId);
  if (!c) return { error: "Course not found." };
  const trimmed = description.trim().slice(0, 2000);
  await prisma.course.update({ where: { id: courseId }, data: { description: trimmed || null } });
  revalidatePath(coursePath(courseId));
}

export async function setCourseStatus(courseId: string, status: string) {
  const c = await getCourseForUser(courseId);
  if (!c) return { error: "Course not found." };
  const s = status === "published" ? "published" : "draft";
  await prisma.course.update({ where: { id: courseId }, data: { status: s } });
  revalidatePath(coursePath(courseId));
  revalidatePath("/courses");
}

export async function deleteCourse(courseId: string) {
  const c = await getCourseForUser(courseId);
  if (!c) return { error: "Course not found." };

  // Best-effort: free any uploaded image objects before dropping the rows
  // (cascade delete handles the DB side; storage needs an explicit cleanup).
  const blocks = await prisma.block.findMany({
    where: { blockType: "image", lesson: { courseId } },
    select: { content: true },
  });
  for (const b of blocks) {
    const { key } = parseBlockContent("image", b.content) as ImageContent;
    if (key) await deleteObject(key);
  }

  await prisma.course.delete({ where: { id: courseId } });
  revalidatePath("/courses");
  redirect("/courses");
}

// ── Lessons ──────────────────────────────────────────────────────────────────

export async function createLesson(courseId: string, title: string) {
  const c = await getCourseForUser(courseId);
  if (!c) return { error: "Course not found." };
  const parsed = LessonTitle.safeParse(title);
  if (!parsed.success) return { error: "Lesson title is required." };
  const last = await prisma.lesson.findFirst({
    where: { courseId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const lesson = await prisma.lesson.create({
    data: { courseId, title: parsed.data, position: positionBetween(last?.position ?? null, null) },
    select: { id: true, title: true, position: true },
  });
  revalidatePath(coursePath(courseId));
  return { lesson };
}

export async function renameLesson(lessonId: string, title: string) {
  const l = await getLessonForUser(lessonId);
  if (!l) return { error: "Lesson not found." };
  const parsed = LessonTitle.safeParse(title);
  if (!parsed.success) return { error: "Lesson title is required." };
  await prisma.lesson.update({ where: { id: lessonId }, data: { title: parsed.data } });
  revalidatePath(coursePath(l.courseId));
}

export async function moveLesson(lessonId: string, targetIndex: number) {
  const l = await getLessonForUser(lessonId);
  if (!l) return { error: "Lesson not found." };
  const siblings = await prisma.lesson.findMany({
    where: { courseId: l.courseId, id: { not: lessonId } },
    orderBy: { position: "asc" },
    select: { position: true },
  });
  const position = positionForIndex(siblings.map((s) => s.position), targetIndex);
  await prisma.lesson.update({ where: { id: lessonId }, data: { position } });
  revalidatePath(coursePath(l.courseId));
}

export async function deleteLesson(lessonId: string) {
  const l = await getLessonForUser(lessonId);
  if (!l) return { error: "Lesson not found." };
  await prisma.lesson.delete({ where: { id: lessonId } });
  revalidatePath(coursePath(l.courseId));
}

// ── Blocks ───────────────────────────────────────────────────────────────────

export async function createBlock(lessonId: string, blockType: string, atIndex?: number) {
  const l = await getLessonForUser(lessonId);
  if (!l) return { error: "Lesson not found." };
  const t = BlockTypeE.safeParse(blockType);
  if (!t.success) return { error: "Unknown block type." };

  const siblings = await prisma.block.findMany({
    where: { lessonId },
    orderBy: { position: "asc" },
    select: { position: true },
  });
  const positions = siblings.map((s) => s.position);
  const position =
    typeof atIndex === "number"
      ? positionForIndex(positions, atIndex)
      : positionBetween(positions[positions.length - 1] ?? null, null);

  const block = await prisma.block.create({
    data: {
      lessonId,
      blockType: t.data,
      content: JSON.stringify(defaultBlockContent(t.data as BlockType)),
      position,
    },
    select: { id: true, blockType: true, content: true, position: true },
  });
  revalidatePath(coursePath(l.courseId));
  return { block };
}

export async function updateBlockContent(blockId: string, contentJson: string) {
  const b = await getBlockForUser(blockId);
  if (!b) return { error: "Block not found." };
  if (contentJson.length > 200_000) return { error: "Content too large." };
  try {
    JSON.parse(contentJson);
  } catch {
    return { error: "Invalid content." };
  }
  await prisma.block.update({ where: { id: blockId }, data: { content: contentJson } });
  revalidatePath(coursePath(b.lesson.courseId));
  return { ok: true };
}

export async function moveBlock(blockId: string, targetIndex: number) {
  const b = await getBlockForUser(blockId);
  if (!b) return { error: "Block not found." };
  const siblings = await prisma.block.findMany({
    where: { lessonId: b.lessonId, id: { not: blockId } },
    orderBy: { position: "asc" },
    select: { position: true },
  });
  const position = positionForIndex(siblings.map((s) => s.position), targetIndex);
  await prisma.block.update({ where: { id: blockId }, data: { position } });
  revalidatePath(coursePath(b.lesson.courseId));
}

export async function deleteBlock(blockId: string) {
  const b = await getBlockForUser(blockId);
  if (!b) return { error: "Block not found." };
  // Best-effort: free the image object if this was an uploaded image block.
  const full = await prisma.block.findUnique({ where: { id: blockId }, select: { blockType: true, content: true } });
  if (full?.blockType === "image") {
    const { key } = parseBlockContent("image", full.content) as ImageContent;
    if (key) await deleteObject(key);
  }
  await prisma.block.delete({ where: { id: blockId } });
  revalidatePath(coursePath(b.lesson.courseId));
}

// ── Image uploads ────────────────────────────────────────────────────────────
// Uploaded images live in object storage (not the DB) — the key is stored
// inline in the image block's JSON content. Bundled into the zip on export.

export async function requestCourseImageUpload(
  courseId: string,
  fileName: string,
  mimeType: string,
  sizeBytes: number,
): Promise<{ error: string } | { uploadUrl: string; key: string }> {
  const c = await getCourseForUser(courseId);
  if (!c) return { error: "Course not found." };
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return { error: "Invalid file." };
  if (sizeBytes > MAX_UPLOAD_BYTES) return { error: "File exceeds the 25 MB limit." };
  if (!mimeType.startsWith("image/")) return { error: "Only image files are supported." };
  const name = z.string().trim().min(1).max(255).safeParse(fileName);
  if (!name.success) return { error: "Invalid file name." };

  const key = buildCourseImageKey(c.workspaceId, courseId, name.data);
  const uploadUrl = await presignUpload(key, mimeType);
  return { uploadUrl, key };
}

/** Fresh inline-view URL for an uploaded image (objects aren't public). */
export async function getCourseImageViewUrl(courseId: string, key: string): Promise<{ error: string } | { url: string }> {
  const c = await getCourseForUser(courseId);
  if (!c) return { error: "Course not found." };
  if (!key.startsWith(`workspace/${c.workspaceId}/course/${courseId}/`)) {
    return { error: "Invalid image key." };
  }
  return { url: await presignView(key) };
}
