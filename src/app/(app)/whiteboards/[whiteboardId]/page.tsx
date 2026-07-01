import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getWhiteboardForUser, storyboardVisibilityWhere } from "@/lib/authz";
import { WhiteboardView } from "@/components/whiteboard/whiteboard-view";

export const metadata = { title: "Whiteboard · IDStudio" };

export default async function WhiteboardPage({ params }: { params: Promise<{ whiteboardId: string }> }) {
  const { whiteboardId } = await params;

  const access = await getWhiteboardForUser(whiteboardId);
  if (!access) notFound();

  const [whiteboard, storyboards] = await Promise.all([
    prisma.whiteboard.findUnique({
      where: { id: whiteboardId },
      select: { id: true, title: true, scene: true, storyboard: { select: { id: true, title: true } } },
    }),
    prisma.storyboard.findMany({
      where: { workspaceId: access.workspaceId, ...(await storyboardVisibilityWhere()) },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);
  if (!whiteboard) notFound();

  return (
    <WhiteboardView
      whiteboard={{
        id: whiteboard.id,
        title: whiteboard.title,
        scene: whiteboard.scene,
        storyboardId: whiteboard.storyboard?.id ?? null,
      }}
      storyboards={storyboards}
    />
  );
}
