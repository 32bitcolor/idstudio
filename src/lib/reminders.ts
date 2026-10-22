import type { PrismaClient } from "../generated/prisma/client";
import { cardDueReminder, milestoneDueReminder, reviewDueReminder, withLink } from "./email-templates";
import { appUrl } from "./app-url";
import { notificationEnabled } from "./notifications";
import { guestLinkPath } from "./review-guest-token";

type EmailMsg = { to: string; subject: string; html: string; text: string };
type Enqueue = (msg: EmailMsg) => Promise<void>;

/**
 * Scan for work due *tomorrow* and enqueue reminder emails — cards (to their
 * assignees), milestones (to workspace admins) and undecided reviews (to the
 * reviewer, member or guest). Runs daily from the worker;
 * the one-day-out window means each item is reminded exactly once. Dependencies
 * are injected so this stays out of the server-only Prisma client.
 */
export async function runDueReminders(prisma: PrismaClient, enqueue: Enqueue): Promise<number> {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const dayAfter = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2));
  let sent = 0;

  // Per-workspace "reminders" toggle, cached so each workspace is read once.
  const remindersOnCache = new Map<string, boolean>();
  async function remindersOn(workspaceId: string): Promise<boolean> {
    const cached = remindersOnCache.get(workspaceId);
    if (cached !== undefined) return cached;
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { notificationSettings: true },
    });
    const on = notificationEnabled(ws?.notificationSettings, "reminders");
    remindersOnCache.set(workspaceId, on);
    return on;
  }

  // Cards due tomorrow, not done, top-level (has a column), with assignees.
  const cards = await prisma.card.findMany({
    where: { dueDate: { gte: tomorrow, lt: dayAfter }, done: false, columnId: { not: null } },
    select: {
      id: true,
      title: true,
      assignees: { select: { user: { select: { name: true, email: true } } } },
      column: { select: { board: { select: { id: true, name: true, workspaceId: true } } } },
    },
  });
  for (const c of cards) {
    if (c.column && !(await remindersOn(c.column.board.workspaceId))) continue;
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
    if (!(await remindersOn(m.project.workspaceId))) continue;
    const admins = await prisma.user.findMany({
      where: { memberships: { some: { workspaceId: m.project.workspaceId, role: "ADMIN", suspendedAt: null } } },
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

  // Reviews due tomorrow that the reviewer hasn't decided yet, in rounds still open.
  // Guests get their current link (re-derivable — see review-guest-token.ts) unless
  // it's been turned off or has expired.
  const reviews = await prisma.reviewCycle.findMany({
    where: {
      dueDate: { gte: tomorrow, lt: dayAfter },
      status: { in: ["requested", "in_review"] },
      reviewRound: { outcome: null },
    },
    select: {
      roundId: true,
      reviewRound: { select: { number: true, deliverableId: true } },
      reviewer: { select: { name: true, email: true } },
      guest: { select: { id: true, name: true, email: true, nonce: true, revokedAt: true, expiresAt: true } },
      deliverable: { select: { name: true, project: { select: { workspaceId: true } } } },
    },
  });
  for (const r of reviews) {
    if (!(await remindersOn(r.deliverable.project.workspaceId))) continue;
    // A later round has replaced this one; its reviewers were asked again there.
    const newer = await prisma.reviewRound.count({
      where: { deliverableId: r.reviewRound.deliverableId, number: { gt: r.reviewRound.number } },
    });
    if (newer) continue;
    let to: { name: string; email: string } | null = null;
    let link: string | undefined;
    if (r.reviewer?.email) {
      to = { name: r.reviewer.name ?? r.reviewer.email, email: r.reviewer.email };
      link = appUrl(`/reviews/${r.roundId}`);
    } else if (r.guest && !r.guest.revokedAt && r.guest.expiresAt > now) {
      to = { name: r.guest.name, email: r.guest.email };
      link = appUrl(guestLinkPath(r.guest));
    }
    if (!to) continue;
    await enqueue({
      to: to.email,
      ...withLink(reviewDueReminder({ reviewerName: to.name, deliverableName: r.deliverable.name, when: "tomorrow" }), link, "Open the review →"),
    });
    sent++;
  }

  return sent;
}
