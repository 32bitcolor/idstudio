import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { boardVisibilityWhere } from "@/lib/authz";
import { Role } from "@/generated/prisma/client";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { WorkloadView, type MemberWorkload } from "@/components/team/workload-view";

export const metadata = { title: "Team · IDStudio" };

export default async function TeamPage() {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");
  if (membership.role !== Role.ADMIN) redirect("/settings/account");

  const wsId = membership.workspaceId;
  const boardVis = await boardVisibilityWhere();

  const [members, cards, subtasks] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId: wsId },
      orderBy: { createdAt: "asc" },
      select: { role: true, user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.card.findMany({
      where: { assignees: { some: {} }, column: { board: { workspaceId: wsId, ...boardVis } } },
      select: {
        id: true,
        title: true,
        dueDate: true,
        assignees: { select: { userId: true } },
        column: { select: { name: true, board: { select: { id: true, name: true } } } },
      },
    }),
    prisma.checklistItem.findMany({
      where: {
        assigneeId: { not: null },
        done: false,
        card: { column: { board: { workspaceId: wsId, ...boardVis } } },
      },
      select: {
        id: true,
        text: true,
        dueDate: true,
        assigneeId: true,
        card: { select: { id: true, title: true, column: { select: { name: true, board: { select: { id: true, name: true } } } } } },
      },
    }),
  ]);

  const workload: MemberWorkload[] = members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    cards: cards
      .filter((c) => c.assignees.some((a) => a.userId === m.user.id))
      .map((c) => ({
        id: c.id,
        title: c.title,
        dueDate: c.dueDate ? c.dueDate.toISOString() : null,
        boardId: c.column.board.id,
        boardName: c.column.board.name,
        columnName: c.column.name,
      })),
    subtasks: subtasks
      .filter((s) => s.assigneeId === m.user.id)
      .map((s) => ({
        id: s.id,
        text: s.text,
        dueDate: s.dueDate ? s.dueDate.toISOString() : null,
        cardId: s.card.id,
        cardTitle: s.card.title,
        boardId: s.card.column.board.id,
        boardName: s.card.column.board.name,
      })),
  }));

  return (
    <PageContainer>
      <PageHeader
        eyebrow={membership.workspace.name}
        title="Team"
        description="What everyone's working on, at a glance."
      />
      <div className="mt-6">
        <WorkloadView workload={workload} />
      </div>
    </PageContainer>
  );
}
