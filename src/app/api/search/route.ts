import { getCurrentUser, getActiveMembership } from "@/lib/dal";
import { prisma } from "@/lib/db";
import {
  boardVisibilityWhere,
  projectVisibilityWhere,
  storyboardVisibilityWhere,
  courseVisibilityWhere,
  whiteboardVisibilityWhere,
} from "@/lib/authz";

const TAKE = 5;

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const membership = await getActiveMembership();
  if (!membership) return Response.json({ results: [] });

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ results: [] });

  const wsId = membership.workspaceId;
  const contains = { contains: q, mode: "insensitive" as const };

  const [boards, projects, storyboards, courses, whiteboards, cards] = await Promise.all([
    prisma.board.findMany({
      where: { workspaceId: wsId, name: contains, ...(await boardVisibilityWhere()) },
      select: { id: true, name: true },
      take: TAKE,
    }),
    prisma.project.findMany({
      where: { workspaceId: wsId, name: contains, ...(await projectVisibilityWhere()) },
      select: { id: true, name: true },
      take: TAKE,
    }),
    prisma.storyboard.findMany({
      where: { workspaceId: wsId, title: contains, ...(await storyboardVisibilityWhere()) },
      select: { id: true, title: true },
      take: TAKE,
    }),
    prisma.course.findMany({
      where: { workspaceId: wsId, title: contains, ...(await courseVisibilityWhere()) },
      select: { id: true, title: true },
      take: TAKE,
    }),
    prisma.whiteboard.findMany({
      where: { workspaceId: wsId, title: contains, ...(await whiteboardVisibilityWhere()) },
      select: { id: true, title: true },
      take: TAKE,
    }),
    // Cards and subtasks alike — a subtask is just a Card with parentCardId
    // set, reached through its parent's column instead of its own (it has
    // none). Both open the same board with the card's drawer deep-linked.
    prisma.card.findMany({
      where: {
        title: contains,
        OR: [
          { columnId: { not: null }, column: { board: { workspaceId: wsId, ...(await boardVisibilityWhere()) } } },
          {
            parentCardId: { not: null },
            parentCard: { column: { board: { workspaceId: wsId, ...(await boardVisibilityWhere()) } } },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        parentCardId: true,
        column: { select: { boardId: true } },
        parentCard: { select: { column: { select: { boardId: true } } } },
      },
      take: TAKE,
    }),
  ]);

  const results = [
    ...boards.map((b) => ({ type: "board" as const, id: b.id, label: b.name, href: `/boards/${b.id}` })),
    ...projects.map((p) => ({ type: "project" as const, id: p.id, label: p.name, href: `/projects/${p.id}` })),
    ...storyboards.map((s) => ({ type: "storyboard" as const, id: s.id, label: s.title, href: `/storyboards/${s.id}` })),
    ...courses.map((c) => ({ type: "course" as const, id: c.id, label: c.title, href: `/courses/${c.id}` })),
    ...whiteboards.map((w) => ({ type: "whiteboard" as const, id: w.id, label: w.title, href: `/whiteboards/${w.id}` })),
    ...cards.map((c) => {
      const boardId = c.column?.boardId ?? c.parentCard!.column!.boardId;
      const type: "card" | "subtask" = c.parentCardId ? "subtask" : "card";
      return { type, id: c.id, label: c.title, href: `/boards/${boardId}?card=${c.id}` };
    }),
  ];

  return Response.json({ results });
}
