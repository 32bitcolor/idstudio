"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { getActiveMembership } from "@/lib/dal";
import { getExamForUser, getQuestionForUser, getOptionForUser, getDeliverableForUser } from "@/lib/authz";
import { positionBetween, positionForIndex } from "@/lib/ordering";
import {
  EXAM_STATUSES,
  QUESTION_TYPES,
  isSingleCorrect,
  PASSING_SCORE_MIN,
  PASSING_SCORE_MAX,
} from "@/lib/exam";

const Title = z.string().trim().min(1, "Required").max(180);
const OptionText = z.string().trim().min(1, "Required").max(500);
const QuestionType = z.enum(QUESTION_TYPES);

function examPath(examId: string) {
  return `/exams/${examId}`;
}

// ── Exams ────────────────────────────────────────────────────────────────────

export async function createExam(formData: FormData): Promise<void> {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");

  const title = Title.safeParse(formData.get("title"));
  if (!title.success) return;

  const exam = await prisma.exam.create({
    data: { workspaceId: membership.workspaceId, title: title.data },
    select: { id: true },
  });

  redirect(examPath(exam.id));
}

export async function renameExam(examId: string, title: string) {
  const exam = await getExamForUser(examId);
  if (!exam) return { error: "Exam not found." };
  const parsed = Title.safeParse(title);
  if (!parsed.success) return { error: "Title is required." };
  await prisma.exam.update({ where: { id: examId }, data: { title: parsed.data } });
  revalidatePath(examPath(examId));
  revalidatePath("/exams");
}

export async function updateExamDescription(examId: string, description: string) {
  const exam = await getExamForUser(examId);
  if (!exam) return { error: "Exam not found." };
  await prisma.exam.update({
    where: { id: examId },
    data: { description: description.trim() ? description.trim().slice(0, 2000) : null },
  });
  revalidatePath(examPath(examId));
}

export async function setExamStatus(examId: string, status: string) {
  const exam = await getExamForUser(examId);
  if (!exam) return { error: "Exam not found." };
  const parsed = z.enum(EXAM_STATUSES).safeParse(status);
  if (!parsed.success) return { error: "Invalid status." };
  await prisma.exam.update({ where: { id: examId }, data: { status: parsed.data } });
  revalidatePath(examPath(examId));
  revalidatePath("/exams");
}

const ExamSettings = z.object({
  passingScore: z.number().int().min(PASSING_SCORE_MIN).max(PASSING_SCORE_MAX),
  timeLimitMinutes: z.number().int().min(1).max(1440).nullable(),
  maxAttempts: z.number().int().min(1).max(100).nullable(),
  shuffleQuestions: z.boolean(),
});

export async function updateExamSettings(examId: string, settings: z.infer<typeof ExamSettings>) {
  const exam = await getExamForUser(examId);
  if (!exam) return { error: "Exam not found." };
  const parsed = ExamSettings.safeParse(settings);
  if (!parsed.success) return { error: "Invalid settings." };
  await prisma.exam.update({ where: { id: examId }, data: parsed.data });
  revalidatePath(examPath(examId));
}

export async function deleteExam(examId: string) {
  const exam = await getExamForUser(examId);
  if (!exam) return { error: "Exam not found." };
  await prisma.exam.delete({ where: { id: examId } });
  redirect("/exams");
}

/**
 * Create an exam linked to a project deliverable (titled after it). If one is
 * already linked, returns the existing exam instead of creating another. Mirrors
 * createStoryboardForDeliverable.
 */
export async function createExamForDeliverable(deliverableId: string) {
  const access = await getDeliverableForUser(deliverableId);
  if (!access) return { error: "Deliverable not found." };
  const deliverable = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    select: {
      name: true,
      project: { select: { workspaceId: true } },
      exam: { select: { id: true, title: true } },
    },
  });
  if (!deliverable) return { error: "Deliverable not found." };
  if (deliverable.exam) return { exam: deliverable.exam };

  const exam = await prisma.exam.create({
    data: { workspaceId: deliverable.project.workspaceId, deliverableId, title: deliverable.name },
    select: { id: true, title: true },
  });
  revalidatePath(`/projects/${access.projectId}`);
  revalidatePath("/exams");
  return { exam };
}

// ── Questions ────────────────────────────────────────────────────────────────

const QUESTION_SELECT = {
  id: true,
  type: true,
  prompt: true,
  points: true,
  explanation: true,
  position: true,
  options: {
    orderBy: { position: "asc" },
    select: { id: true, text: true, isCorrect: true, position: true },
  },
} satisfies Prisma.QuestionSelect;

async function lastChildPosition(model: "question" | "questionOption", where: Prisma.QuestionWhereInput | Prisma.QuestionOptionWhereInput) {
  // Both models order by `position`; fetch the current tail to append after it.
  const last =
    model === "question"
      ? await prisma.question.findFirst({ where: where as Prisma.QuestionWhereInput, orderBy: { position: "desc" }, select: { position: true } })
      : await prisma.questionOption.findFirst({ where: where as Prisma.QuestionOptionWhereInput, orderBy: { position: "desc" }, select: { position: true } });
  return positionBetween(last?.position ?? null, null);
}

export async function createQuestion(examId: string, type?: string) {
  const exam = await getExamForUser(examId);
  if (!exam) return { error: "Exam not found." };
  const parsedType = type ? QuestionType.safeParse(type) : { success: true as const, data: "multiple_choice" as const };
  if (!parsedType.success) return { error: "Invalid question type." };

  const position = await lastChildPosition("question", { examId });

  // true_false questions are seeded with True / False options so they're usable
  // immediately; other choice types start empty for the author to fill in.
  const optionData =
    parsedType.data === "true_false"
      ? { create: [
          { text: "True", isCorrect: true, position: positionBetween(null, null) },
          { text: "False", isCorrect: false, position: positionBetween(positionBetween(null, null), null) },
        ] }
      : undefined;

  const question = await prisma.question.create({
    data: { examId, type: parsedType.data, position, options: optionData },
    select: QUESTION_SELECT,
  });
  revalidatePath(examPath(examId));
  return { question };
}

export async function updateQuestionPrompt(id: string, value: string | null) {
  const q = await getQuestionForUser(id);
  if (!q) return { error: "Question not found." };
  await prisma.question.update({
    where: { id },
    data: { prompt: value && value.trim() ? value : null },
  });
  revalidatePath(examPath(q.examId));
}

export async function updateQuestionExplanation(id: string, value: string | null) {
  const q = await getQuestionForUser(id);
  if (!q) return { error: "Question not found." };
  await prisma.question.update({
    where: { id },
    data: { explanation: value && value.trim() ? value : null },
  });
  revalidatePath(examPath(q.examId));
}

export async function updateQuestionPoints(id: string, points: number) {
  const q = await getQuestionForUser(id);
  if (!q) return { error: "Question not found." };
  const parsed = z.number().int().min(0).max(1000).safeParse(points);
  if (!parsed.success) return { error: "Invalid points." };
  await prisma.question.update({ where: { id }, data: { points: parsed.data } });
  revalidatePath(examPath(q.examId));
}

export async function setQuestionType(id: string, type: string) {
  const q = await getQuestionForUser(id);
  if (!q) return { error: "Question not found." };
  const parsed = QuestionType.safeParse(type);
  if (!parsed.success) return { error: "Invalid question type." };

  // Switching to true_false with no options yet seeds True / False. Switching to a
  // single-correct type collapses any extra correct flags down to the first one.
  const existing = await prisma.questionOption.findMany({
    where: { questionId: id },
    orderBy: { position: "asc" },
    select: { id: true, isCorrect: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.question.update({ where: { id }, data: { type: parsed.data } });

    if (parsed.data === "true_false" && existing.length === 0) {
      await tx.questionOption.createMany({
        data: [
          { questionId: id, text: "True", isCorrect: true, position: positionBetween(null, null) },
          { questionId: id, text: "False", isCorrect: false, position: positionBetween(positionBetween(null, null), null) },
        ],
      });
    } else if (isSingleCorrect(parsed.data)) {
      const firstCorrect = existing.find((o) => o.isCorrect);
      if (firstCorrect) {
        await tx.questionOption.updateMany({
          where: { questionId: id, id: { not: firstCorrect.id }, isCorrect: true },
          data: { isCorrect: false },
        });
      }
    }
  });

  const options = await prisma.questionOption.findMany({
    where: { questionId: id },
    orderBy: { position: "asc" },
    select: { id: true, text: true, isCorrect: true, position: true },
  });
  revalidatePath(examPath(q.examId));
  return { options };
}

export async function moveQuestion(id: string, targetIndex: number) {
  const q = await getQuestionForUser(id);
  if (!q) return { error: "Question not found." };
  const siblings = await prisma.question.findMany({
    where: { examId: q.examId, id: { not: id } },
    orderBy: { position: "asc" },
    select: { position: true },
  });
  const position = positionForIndex(siblings.map((x) => x.position), targetIndex);
  await prisma.question.update({ where: { id }, data: { position } });
  revalidatePath(examPath(q.examId));
}

export async function deleteQuestion(id: string) {
  const q = await getQuestionForUser(id);
  if (!q) return { error: "Question not found." };
  await prisma.question.delete({ where: { id } });
  revalidatePath(examPath(q.examId));
}

// ── Options ──────────────────────────────────────────────────────────────────

export async function createOption(questionId: string, text: string) {
  const q = await getQuestionForUser(questionId);
  if (!q) return { error: "Question not found." };
  const parsed = OptionText.safeParse(text);
  if (!parsed.success) return { error: "Option text is required." };

  const position = await lastChildPosition("questionOption", { questionId });
  const option = await prisma.questionOption.create({
    data: { questionId, text: parsed.data, position },
    select: { id: true, text: true, isCorrect: true, position: true },
  });
  revalidatePath(examPath(q.examId));
  return { option };
}

export async function updateOptionText(id: string, text: string) {
  const o = await getOptionForUser(id);
  if (!o) return { error: "Option not found." };
  const parsed = OptionText.safeParse(text);
  if (!parsed.success) return { error: "Option text is required." };
  await prisma.questionOption.update({ where: { id }, data: { text: parsed.data } });
  revalidatePath(examPath(o.question.examId));
}

export async function setOptionCorrect(id: string, isCorrect: boolean) {
  const o = await getOptionForUser(id);
  if (!o) return { error: "Option not found." };

  // Single-correct questions (multiple_choice / true_false) allow exactly one
  // correct option: marking one true clears its siblings in the same question.
  if (isCorrect && isSingleCorrect(o.question.type)) {
    await prisma.$transaction([
      prisma.questionOption.updateMany({
        where: { questionId: o.questionId, id: { not: id } },
        data: { isCorrect: false },
      }),
      prisma.questionOption.update({ where: { id }, data: { isCorrect: true } }),
    ]);
  } else {
    await prisma.questionOption.update({ where: { id }, data: { isCorrect } });
  }
  revalidatePath(examPath(o.question.examId));
}

export async function moveOption(id: string, targetIndex: number) {
  const o = await getOptionForUser(id);
  if (!o) return { error: "Option not found." };
  const siblings = await prisma.questionOption.findMany({
    where: { questionId: o.questionId, id: { not: id } },
    orderBy: { position: "asc" },
    select: { position: true },
  });
  const position = positionForIndex(siblings.map((x) => x.position), targetIndex);
  await prisma.questionOption.update({ where: { id }, data: { position } });
  revalidatePath(examPath(o.question.examId));
}

export async function deleteOption(id: string) {
  const o = await getOptionForUser(id);
  if (!o) return { error: "Option not found." };
  await prisma.questionOption.delete({ where: { id } });
  revalidatePath(examPath(o.question.examId));
}
