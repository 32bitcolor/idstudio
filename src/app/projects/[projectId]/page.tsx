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
    />
  );
}
