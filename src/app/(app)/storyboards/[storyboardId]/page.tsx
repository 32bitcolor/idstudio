import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStoryboardForUser, whiteboardVisibilityWhere } from "@/lib/authz";
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
      screens: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          screenType: true,
          position: true,
          onScreenText: true,
          narration: true,
          visualNotes: true,
          interactionNotes: true,
          developerNotes: true,
        },
      },
    },
  });
  if (!storyboard) notFound();

  const whiteboards = await prisma.whiteboard.findMany({
    where: { storyboardId, ...(await whiteboardVisibilityWhere()) },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true },
  });

  return (
    <StoryboardView
      whiteboards={whiteboards}
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
      initialScreens={storyboard.screens}
    />
  );
}
