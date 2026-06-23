import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStoryboardForUser } from "@/lib/authz";
import { StoryboardView } from "@/components/storyboard/storyboard-view";

export const metadata = { title: "Storyboard · IDStudio" };

export default async function StoryboardPage({ params }: { params: Promise<{ storyboardId: string }> }) {
  const { storyboardId } = await params;

  const access = await getStoryboardForUser(storyboardId);
  if (!access) notFound();

  const storyboard = await prisma.storyboard.findUnique({
    where: { id: storyboardId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      deliverable: {
        select: { id: true, name: true, projectId: true, project: { select: { name: true } } },
      },
    },
  });
  if (!storyboard) notFound();

  return (
    <StoryboardView
      storyboard={{
        id: storyboard.id,
        title: storyboard.title,
        description: storyboard.description,
        status: storyboard.status,
        deliverable: storyboard.deliverable
          ? {
              id: storyboard.deliverable.id,
              name: storyboard.deliverable.name,
              projectId: storyboard.deliverable.projectId,
              projectName: storyboard.deliverable.project.name,
            }
          : null,
      }}
    />
  );
}
