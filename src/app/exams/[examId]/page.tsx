import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getExamForUser } from "@/lib/authz";
import { ExamView } from "@/components/exam/exam-view";

export const metadata = { title: "Exam · IDStudio" };

export default async function ExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;

  const access = await getExamForUser(examId);
  if (!access) notFound();

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      passingScore: true,
      timeLimitMinutes: true,
      maxAttempts: true,
      shuffleQuestions: true,
      deliverable: {
        select: { id: true, name: true, projectId: true, project: { select: { name: true } } },
      },
      questions: {
        orderBy: { position: "asc" },
        select: {
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
        },
      },
    },
  });
  if (!exam) notFound();

  return (
    <ExamView
      exam={{
        id: exam.id,
        title: exam.title,
        description: exam.description,
        status: exam.status,
        passingScore: exam.passingScore,
        timeLimitMinutes: exam.timeLimitMinutes,
        maxAttempts: exam.maxAttempts,
        shuffleQuestions: exam.shuffleQuestions,
        deliverable: exam.deliverable
          ? {
              id: exam.deliverable.id,
              name: exam.deliverable.name,
              projectId: exam.deliverable.projectId,
              projectName: exam.deliverable.project.name,
            }
          : null,
      }}
      initialQuestions={exam.questions}
    />
  );
}
