import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getBoardForUser } from "@/lib/authz";
import { BoardView } from "@/components/board/board-view";
import type { ProjectContext } from "@/components/board/project-context-strip";

export const metadata = { title: "Board · IDStudio" };

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;

  const board = await getBoardForUser(boardId);
  if (!board) notFound();

  const meta = await prisma.board.findUnique({
    where: { id: boardId },
    select: { project: { select: { id: true, name: true } } },
  });

  const raw = await prisma.column.findMany({
    where: { boardId },
    orderBy: { position: "asc" },
    select: {
      id: true,
      name: true,
      position: true,
      status: { select: { category: true } },
      cards: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          position: true,
          dueDate: true,
          keySeq: true,
          labels: { select: { label: { select: { id: true, name: true, color: true } } } },
          assignees: { select: { user: { select: { id: true, name: true, email: true } } } },
          smes: { select: { user: { select: { id: true, name: true, email: true } } } },
          subtasks: { select: { done: true } },
          // The deliverable a card produces, with its most recent review round —
          // surfaced on the card face so the board shows where review stands.
          deliverables: {
            take: 1,
            select: {
              name: true,
              reviewCycles: { orderBy: { round: "desc" }, take: 1, select: { round: true, status: true } },
            },
          },
          _count: { select: { comments: true, attachments: true } },
        },
      },
    },
  });

  const columns = raw.map((c) => ({
    id: c.id,
    name: c.name,
    position: c.position,
    category: (c.status?.category ?? null) as "todo" | "active" | "done" | null,
    cards: c.cards.map((card) => {
      const d = card.deliverables[0];
      const review = d?.reviewCycles[0];
      return {
        id: card.id,
        title: card.title,
        description: card.description,
        position: card.position,
        dueDate: card.dueDate ? card.dueDate.toISOString() : null,
        keySeq: card.keySeq,
        labels: card.labels.map((l) => l.label),
        assignees: card.assignees.map((a) => a.user),
        smes: card.smes.map((s) => s.user),
        checklist: { total: card.subtasks.length, done: card.subtasks.filter((i) => i.done).length },
        comments: card._count.comments,
        attachments: card._count.attachments,
        deliverable: d ? { name: d.name, review: review ? { round: review.round, status: review.status } : null } : null,
      };
    }),
  }));

  const project = meta?.project ?? null;
  const context = project ? await loadProjectContext(project.id) : null;

  return (
    <BoardView
      boardId={boardId}
      boardName={board.name}
      cardKeyPrefix={board.cardKeyPrefix}
      project={project}
      context={context}
      initialColumns={columns}
    />
  );
}

/** The at-a-glance strip a project's board shows: where the project is, what's next,
 *  and whether its objectives are covered — the learning-design context a generic
 *  Kanban doesn't have. */
async function loadProjectContext(projectId: string): Promise<ProjectContext> {
  const [phases, milestone, objectives] = await Promise.all([
    prisma.phase.findMany({
      where: { projectId },
      orderBy: { position: "asc" },
      select: { name: true, status: true, startDate: true, endDate: true },
    }),
    prisma.milestone.findFirst({
      where: { projectId, completedAt: null, dueDate: { not: null } },
      orderBy: { dueDate: "asc" },
      select: { name: true, dueDate: true },
    }),
    prisma.learningObjective.findMany({
      where: { projectId },
      select: { _count: { select: { screens: true, assessments: true } } },
    }),
  ]);

  const current = phases.find((p) => p.status === "in_progress") ?? phases.find((p) => p.status === "not_started") ?? null;
  let phase: ProjectContext["phase"] = null;
  if (current) {
    const day = 86_400_000;
    const total =
      current.startDate && current.endDate
        ? Math.max(1, Math.round((current.endDate.getTime() - current.startDate.getTime()) / day) + 1)
        : null;
    const elapsed =
      total && current.startDate && current.status === "in_progress"
        ? Math.min(total, Math.max(1, Math.floor((Date.now() - current.startDate.getTime()) / day) + 1))
        : null;
    phase = {
      name: current.name,
      status: current.status as "in_progress" | "not_started",
      day: elapsed,
      of: total,
      done: phases.filter((p) => p.status === "done").length,
      count: phases.length,
    };
  }

  return {
    projectId,
    phase,
    milestone: milestone?.dueDate ? { name: milestone.name, dueDate: milestone.dueDate.toISOString() } : null,
    objectives: {
      total: objectives.length,
      taught: objectives.filter((o) => o._count.screens > 0).length,
      assessed: objectives.filter((o) => o._count.assessments > 0).length,
      // An objective with no teaching screen OR no assessment item is a gap.
      gaps: objectives.filter((o) => o._count.screens === 0 || o._count.assessments === 0).length,
    },
  };
}
