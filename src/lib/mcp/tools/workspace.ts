import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import {
  boardVisibilityWhere,
  projectVisibilityWhere,
  storyboardVisibilityWhere,
  whiteboardVisibilityWhere,
  resolveCardKey,
} from "@/lib/authz";
import { isDecided } from "@/lib/methodology";
import { ticketLabel } from "@/lib/intake";
import { day, link, principal, tool } from "@/lib/mcp/util";

export function cardHref(boardId: string, cardId: string) {
  return link(`/boards/${boardId}?card=${cardId}`);
}

export function registerWorkspaceTools(server: McpServer) {
  tool(
    server,
    "get_workspace",
    {
      title: "Workspace overview",
      description:
        "Who you are, which workspace this connection works in, and the reference lists other tools take as input: members (for assignees and reviewers), board statuses, labels and sprints. Call this first in a conversation.",
      input: {},
      kind: "read",
    },
    async () => {
      const p = principal();
      const me = await getCurrentUser();
      const [ws, members, statuses, labels, sprints] = await Promise.all([
        prisma.workspace.findUniqueOrThrow({ where: { id: p.workspaceId }, select: { id: true, name: true, slug: true } }),
        prisma.membership.findMany({
          where: { workspaceId: p.workspaceId },
          orderBy: { createdAt: "asc" },
          select: { role: true, user: { select: { id: true, name: true, email: true } } },
        }),
        prisma.workspaceStatus.findMany({ where: { workspaceId: p.workspaceId }, orderBy: { position: "asc" }, select: { id: true, name: true, category: true } }),
        prisma.label.findMany({ where: { workspaceId: p.workspaceId }, orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
        prisma.sprint.findMany({
          where: { workspaceId: p.workspaceId },
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, status: true, startDate: true, endDate: true, goal: true },
        }),
      ]);
      return {
        workspace: { ...ws, url: link("/dashboard") },
        you: { id: me?.id, name: me?.name, email: me?.email, role: members.find((m) => m.user.id === me?.id)?.role },
        access: p.canWrite ? "read write" : "read",
        members: members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email, role: m.role })),
        statuses,
        labels,
        sprints: sprints.map((s) => ({ ...s, startDate: day(s.startDate), endDate: day(s.endDate) })),
      };
    },
  );

  tool(
    server,
    "search",
    {
      title: "Search the workspace",
      description:
        "Find cards (by title or key like SEC-12), boards, projects, deliverables, storyboards, whiteboards and intake requests by name. Returns ids to pass to the get_* tools.",
      input: { query: z.string().min(2).describe("Words to look for, or a card key such as SEC-12"), limit: z.number().int().min(1).max(50).default(10) },
      kind: "read",
    },
    async ({ query, limit }) => {
      const wsId = principal().workspaceId;
      const contains = { contains: query.trim(), mode: "insensitive" as const };
      const [boardVis, projectVis, storyboardVis, whiteboardVis] = await Promise.all([
        boardVisibilityWhere(),
        projectVisibilityWhere(),
        storyboardVisibilityWhere(),
        whiteboardVisibilityWhere(),
      ]);
      const key = /^([A-Za-z][A-Za-z0-9]{0,9})-(\d+)$/.exec(query.trim());
      const onBoard = { board: { workspaceId: wsId, ...boardVis } };
      const [keyHit, cards, boards, projects, deliverables, storyboards, whiteboards, intake] = await Promise.all([
        key ? resolveCardKey(key[1], Number(key[2])) : null,
        prisma.card.findMany({
          where: { title: contains, OR: [{ column: onBoard }, { parentCard: { column: onBoard } }] },
          take: limit,
          orderBy: { updatedAt: "desc" },
          select: { id: true, title: true, parentCardId: true, column: { select: { boardId: true, name: true } }, parentCard: { select: { column: { select: { boardId: true } } } } },
        }),
        prisma.board.findMany({ where: { workspaceId: wsId, name: contains, ...boardVis }, take: limit, select: { id: true, name: true } }),
        prisma.project.findMany({ where: { workspaceId: wsId, name: contains, ...projectVis }, take: limit, select: { id: true, name: true, status: true } }),
        prisma.deliverable.findMany({
          where: { name: contains, project: { workspaceId: wsId, ...projectVis } },
          take: limit,
          select: { id: true, name: true, status: true, project: { select: { id: true, name: true } } },
        }),
        prisma.storyboard.findMany({ where: { workspaceId: wsId, title: contains, ...storyboardVis }, take: limit, select: { id: true, title: true } }),
        prisma.whiteboard.findMany({ where: { workspaceId: wsId, title: contains, ...whiteboardVis }, take: limit, select: { id: true, title: true } }),
        prisma.intakeRequest.findMany({ where: { workspaceId: wsId, title: contains }, take: limit, select: { id: true, number: true, title: true, status: true } }),
      ]);
      const cardHits = cards.filter((c) => c.id !== keyHit?.cardId);
      return {
        cards: [
          ...(keyHit ? [{ id: keyHit.cardId, title: keyHit.title, subtask: keyHit.isSubtask, url: cardHref(keyHit.boardId, keyHit.cardId) }] : []),
          ...cardHits.map((c) => ({
            id: c.id,
            title: c.title,
            subtask: !!c.parentCardId,
            column: c.column?.name,
            url: cardHref(c.column?.boardId ?? c.parentCard!.column!.boardId, c.id),
          })),
        ],
        boards: boards.map((b) => ({ ...b, url: link(`/boards/${b.id}`) })),
        projects: projects.map((x) => ({ ...x, url: link(`/projects/${x.id}`) })),
        deliverables: deliverables.map((d) => ({ id: d.id, name: d.name, status: d.status, project: d.project })),
        storyboards: storyboards.map((s) => ({ ...s, url: link(`/storyboards/${s.id}`) })),
        whiteboards: whiteboards.map((w) => ({ ...w, url: link(`/whiteboards/${w.id}`) })),
        intakeRequests: intake.map((r) => ({ id: r.id, ticket: ticketLabel(r.number), title: r.title, status: r.status })),
      };
    },
  );

  tool(
    server,
    "get_my_work",
    {
      title: "My work",
      description:
        "Everything waiting on you: reviews you need to decide, reviews you requested that are still open, your assigned cards and subtasks, and upcoming milestones.",
      input: {},
      kind: "read",
    },
    async () => {
      const me = (await getCurrentUser())!;
      const wsId = principal().workspaceId;
      const [projectVis, boardVis] = await Promise.all([projectVisibilityWhere(), boardVisibilityWhere()]);
      const inWs = { project: { workspaceId: wsId, ...projectVis } };
      const [toReview, requested, cards, subtasks, milestones] = await Promise.all([
        prisma.reviewCycle.findMany({
          where: { reviewerId: me.id, status: { in: ["requested", "in_review"] }, deliverable: inWs },
          orderBy: [{ dueDate: "asc" }],
          select: { roundId: true, round: true, status: true, dueDate: true, deliverable: { select: { id: true, name: true, project: { select: { name: true } } } } },
        }),
        prisma.reviewCycle.findMany({
          where: { requestedById: me.id, OR: [{ reviewerId: { not: me.id } }, { reviewerId: null }], status: { in: ["requested", "in_review"] }, deliverable: inWs },
          orderBy: [{ dueDate: "asc" }],
          select: {
            roundId: true, round: true, status: true, dueDate: true,
            reviewer: { select: { name: true, email: true } }, guest: { select: { name: true } },
            deliverable: { select: { id: true, name: true } },
          },
        }),
        prisma.card.findMany({
          where: { assignees: { some: { userId: me.id } }, column: { board: { workspaceId: wsId, ...boardVis } }, NOT: { status: { category: "done" } } },
          orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
          take: 100,
          select: { id: true, title: true, dueDate: true, keySeq: true, column: { select: { name: true, board: { select: { id: true, name: true, cardKeyPrefix: true } } } } },
        }),
        prisma.card.findMany({
          where: { parentCardId: { not: null }, done: false, assignees: { some: { userId: me.id } }, parentCard: { column: { board: { workspaceId: wsId, ...boardVis } } } },
          take: 100,
          select: { id: true, title: true, dueDate: true, parentCard: { select: { id: true, title: true, column: { select: { boardId: true } } } } },
        }),
        prisma.milestone.findMany({
          where: { completedAt: null, dueDate: { not: null }, project: { workspaceId: wsId, ...projectVis } },
          orderBy: { dueDate: "asc" },
          take: 10,
          select: { id: true, name: true, dueDate: true, project: { select: { id: true, name: true } } },
        }),
      ]);
      return {
        reviewsAwaitingYou: toReview.map((r) => ({
          roundId: r.roundId,
          round: r.round,
          status: r.status,
          due: day(r.dueDate),
          deliverable: r.deliverable.name,
          deliverableId: r.deliverable.id,
          project: r.deliverable.project.name,
          url: link(`/reviews/${r.roundId}`),
        })),
        reviewsYouAreWaitingOn: requested.map((r) => ({
          roundId: r.roundId,
          round: r.round,
          reviewer: r.reviewer ? (r.reviewer.name ?? r.reviewer.email) : r.guest ? `${r.guest.name} (guest)` : null,
          status: r.status,
          decided: isDecided(r.status),
          due: day(r.dueDate),
          deliverable: r.deliverable.name,
        })),
        yourCards: cards.map((c) => ({
          id: c.id,
          key: c.column?.board.cardKeyPrefix && c.keySeq ? `${c.column.board.cardKeyPrefix}-${c.keySeq}` : null,
          title: c.title,
          column: c.column?.name,
          board: c.column?.board.name,
          due: day(c.dueDate),
          url: cardHref(c.column!.board.id, c.id),
        })),
        yourSubtasks: subtasks.map((s) => ({
          id: s.id,
          title: s.title,
          due: day(s.dueDate),
          parent: { id: s.parentCard!.id, title: s.parentCard!.title },
          url: cardHref(s.parentCard!.column!.boardId, s.parentCard!.id),
        })),
        upcomingMilestones: milestones.map((m) => ({ id: m.id, name: m.name, due: day(m.dueDate), project: m.project })),
      };
    },
  );
}
