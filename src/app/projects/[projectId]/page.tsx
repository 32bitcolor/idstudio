import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getProjectForUser } from "@/lib/authz";
import { ProjectView } from "@/components/project/project-view";

export const metadata = { title: "Project · IDStudio" };

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const access = await getProjectForUser(projectId);
  if (!access) notFound();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      description: true,
      methodology: true,
      status: true,
      phases: {
        orderBy: { position: "asc" },
        select: { id: true, name: true, status: true, position: true, startDate: true, endDate: true },
      },
      deliverables: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          phaseId: true,
          cardId: true,
          card: {
            select: { id: true, title: true, column: { select: { board: { select: { id: true, name: true } } } } },
          },
        },
      },
      milestones: {
        orderBy: { position: "asc" },
        select: { id: true, name: true, dueDate: true, completedAt: true },
      },
    },
  });
  if (!project) notFound();

  const phases = project.phases.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    position: p.position,
    startDate: p.startDate ? p.startDate.toISOString() : null,
    endDate: p.endDate ? p.endDate.toISOString() : null,
  }));

  const deliverables = project.deliverables.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    status: d.status,
    phaseId: d.phaseId,
    card: d.card
      ? { id: d.card.id, title: d.card.title, boardId: d.card.column.board.id, boardName: d.card.column.board.name }
      : null,
  }));

  const milestones = project.milestones.map((m) => ({
    id: m.id,
    name: m.name,
    dueDate: m.dueDate ? m.dueDate.toISOString() : null,
    completedAt: m.completedAt ? m.completedAt.toISOString() : null,
  }));

  return (
    <ProjectView
      project={{
        id: project.id,
        name: project.name,
        description: project.description,
        methodology: project.methodology,
        status: project.status,
      }}
      initialPhases={phases}
      initialDeliverables={deliverables}
      initialMilestones={milestones}
    />
  );
}
