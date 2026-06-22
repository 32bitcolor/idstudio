import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getBoardForUser } from "@/lib/authz";
import { BoardView } from "@/components/board/board-view";

export const metadata = { title: "Board · IDStudio" };

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;

  const board = await getBoardForUser(boardId);
  if (!board) notFound();

  const raw = await prisma.column.findMany({
    where: { boardId },
    orderBy: { position: "asc" },
    select: {
      id: true,
      name: true,
      position: true,
      cards: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          position: true,
          dueDate: true,
          labels: { select: { label: { select: { id: true, name: true, color: true } } } },
          assignees: { select: { user: { select: { id: true, name: true, email: true } } } },
          checklist: { select: { done: true } },
          _count: { select: { comments: true } },
        },
      },
    },
  });

  const columns = raw.map((c) => ({
    id: c.id,
    name: c.name,
    position: c.position,
    cards: c.cards.map((card) => ({
      id: card.id,
      title: card.title,
      description: card.description,
      position: card.position,
      dueDate: card.dueDate ? card.dueDate.toISOString() : null,
      labels: card.labels.map((l) => l.label),
      assignees: card.assignees.map((a) => a.user),
      checklist: { total: card.checklist.length, done: card.checklist.filter((i) => i.done).length },
      comments: card._count.comments,
    })),
  }));

  return <BoardView boardId={boardId} boardName={board.name} initialColumns={columns} />;
}
