import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { createExam } from "@/app/actions/exams";
import { EXAM_STATUS_LABEL, type ExamStatus } from "@/lib/exam";

export const metadata = { title: "Exams · IDStudio" };

function statusClass(s: string) {
  if (s === "published") return "bg-green-500/15 text-green-600";
  if (s === "archived") return "bg-muted text-foreground/60";
  return "bg-amber-500/15 text-amber-600";
}

export default async function ExamsPage() {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");

  const exams = await prisma.exam.findMany({
    where: { workspaceId: membership.workspaceId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      passingScore: true,
      _count: { select: { questions: true } },
      deliverable: { select: { id: true, name: true, projectId: true } },
    },
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-foreground/60 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Exams</h1>
          <p className="text-sm text-foreground/60">{membership.workspace.name}</p>
        </div>
      </div>

      <form action={createExam} className="mt-6 flex gap-2">
        <input
          name="title"
          required
          maxLength={180}
          placeholder="New exam title…"
          className="w-72 rounded-md border border-border-strong bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/60"
        />
        <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
          Create exam
        </button>
      </form>

      {exams.length === 0 ? (
        <p className="mt-10 text-sm text-foreground/50">No exams yet. Create your first one above.</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => (
            <li key={exam.id}>
              <Link
                href={`/exams/${exam.id}`}
                className="block rounded-xl border border-border p-4 hover:border-foreground/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="min-w-0 font-medium">{exam.title}</h2>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(exam.status)}`}>
                    {EXAM_STATUS_LABEL[exam.status as ExamStatus] ?? exam.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-foreground/50">
                  {exam._count.questions} {exam._count.questions === 1 ? "question" : "questions"} · pass ≥ {exam.passingScore}%
                  {exam.deliverable ? ` · ${exam.deliverable.name}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
