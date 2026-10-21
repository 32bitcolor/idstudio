import "server-only";
import { prisma } from "@/lib/db";
import type { ProjectContext } from "@/components/board/project-context-strip";

/** The at-a-glance strip a project's board shows: where the project is, what's next,
 *  and whether its objectives are covered — the learning-design context a generic
 *  Kanban doesn't have. */
export async function loadProjectContext(projectId: string): Promise<ProjectContext> {
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
