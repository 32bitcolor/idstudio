import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getBoardForUser } from "@/lib/authz";
import { BoardView } from "@/components/board/board-view";

export const metadata = { title: "Board · IDStudio" };

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;

  const board = await getBoardForUser(boardId);
  if (!board) notFound();

  const columns = await prisma.column.findMany({
    where: { boardId },
    orderBy: { position: "asc" },
    select: {
      id: true,
      name: true,
      position: true,
      cards: {
        orderBy: { position: "asc" },
        select: { id: true, title: true, description: true, position: true },
      },
    },
  });

  return <BoardView boardId={boardId} boardName={board.name} initialColumns={columns} />;
}
