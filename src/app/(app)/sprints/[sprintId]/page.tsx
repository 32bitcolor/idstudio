import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { boardVisibilityWhere } from "@/lib/authz";
import { SprintBoard } from "@/components/sprint/sprint-board";

export const metadata = { title: "Sprint board · IDStudio" };

export default async function SprintBoardPage({ params }: { params: Promise<{ sprintId: string }> }) {
  const { sprintId } = await params;
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");
  const wsId = membership.workspaceId;

  const sprint = await prisma.sprint.findFirst({
    where: { id: sprintId, workspaceId: wsId },
    select: { id: true, name: true, goal: true, status: true },
  });
  if (!sprint) notFound();

  const [statuses, cards] = await Promise.all([
    prisma.workspaceStatus.findMany({
      where: { workspaceId: wsId },
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
    // Top-level cards in this sprint whose home board the user can see (respects
    // group visibility). Standalone-board cards are included — they just have no project.
    prisma.card.findMany({
      where: {
        sprintId,
        columnId: { not: null },
        column: { board: { workspaceId: wsId, ...(await boardVisibilityWhere()) } },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        keySeq: true,
        statusId: true,
        dueDate: true,
        assignees: { select: { user: { select: { id: true, name: true, email: true } } } },
        column: {
          select: {
            board: {
              select: {
                id: true,
                cardKeyPrefix: true,
                project: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const items = cards.map((c) => ({
    id: c.id,
    title: c.title,
    keySeq: c.keySeq,
    statusId: c.statusId,
    dueDate: c.dueDate ? c.dueDate.toISOString() : null,
    boardId: c.column!.board.id,
    cardKeyPrefix: c.column!.board.cardKeyPrefix,
    project: c.column!.board.project,
    assignees: c.assignees.map((a) => a.user),
  }));

  return <SprintBoard sprint={sprint} statuses={statuses} initialCards={items} />;
}
