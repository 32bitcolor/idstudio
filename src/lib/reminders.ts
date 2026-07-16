import type { PrismaClient } from "../generated/prisma/client";
import { cardDueReminder, milestoneDueReminder, withLink } from "./email-templates";
import { appUrl } from "./app-url";

type EmailMsg = { to: string; subject: string; html: string; text: string };
type Enqueue = (msg: EmailMsg) => Promise<void>;

/**
 * Scan for work due *tomorrow* and enqueue reminder emails — cards (to their
 * assignees) and milestones (to workspace admins). Runs daily from the worker;
 * the one-day-out window means each item is reminded exactly once. Dependencies
 * are injected so this stays out of the server-only Prisma client.
 */
export async function runDueReminders(prisma: PrismaClient, enqueue: Enqueue): Promise<number> {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const dayAfter = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2));
  let sent = 0;

  // Cards due tomorrow, not done, top-level (has a column), with assignees.
  const cards = await prisma.card.findMany({
    where: { dueDate: { gte: tomorrow, lt: dayAfter }, done: false, columnId: { not: null } },
    select: {
      id: true,
      title: true,
      assignees: { select: { user: { select: { name: true, email: true } } } },
      column: { select: { board: { select: { id: true, name: true } } } },
    },
  });
  for (const c of cards) {
    const boardId = c.column?.board.id;
    const link = boardId ? appUrl(`/boards/${boardId}?card=${c.id}`) : undefined;
    for (const a of c.assignees) {
      if (!a.user.email) continue;
      await enqueue({
        to: a.user.email,
        ...withLink(
          cardDueReminder({
            assigneeName: a.user.name ?? a.user.email,
            cardTitle: c.title,
            boardName: c.column?.board.name ?? "",
            when: "tomorrow",
          }),
          link,
        ),
      });
      sent++;
    }
  }

  // Milestones due tomorrow, not completed → notify the workspace's admins.
  const milestones = await prisma.milestone.findMany({
    where: { dueDate: { gte: tomorrow, lt: dayAfter }, completedAt: null },
    select: { name: true, project: { select: { id: true, name: true, workspaceId: true } } },
  });
  for (const m of milestones) {
    const admins = await prisma.user.findMany({
      where: { memberships: { some: { workspaceId: m.project.workspaceId, role: "ADMIN" } } },
      select: { name: true, email: true },
    });
    const link = appUrl(`/projects/${m.project.id}`);
    for (const admin of admins) {
      if (!admin.email) continue;
      await enqueue({
        to: admin.email,
        ...withLink(
          milestoneDueReminder({
            recipientName: admin.name ?? admin.email,
            milestoneName: m.name,
            projectName: m.project.name,
            when: "tomorrow",
          }),
          link,
        ),
      });
      sent++;
    }
  }

  return sent;
}
