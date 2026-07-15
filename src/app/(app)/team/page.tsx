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
  // Oversight role: MANAGER gets this "what's everyone working on" view too, same as ADMIN.
  if (membership.role !== Role.ADMIN && membership.role !== Role.MANAGER) redirect("/settings/account");

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
    prisma.card.findMany({
      where: {
        parentCardId: { not: null },
        assignees: { some: {} },
        done: false,
        parentCard: { column: { board: { workspaceId: wsId, ...boardVis } } },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        assignees: { select: { userId: true } },
        parentCard: { select: { id: true, title: true, column: { select: { name: true, board: { select: { id: true, name: true } } } } } },
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
        boardId: c.column!.board.id,
        boardName: c.column!.board.name,
        columnName: c.column!.name,
      })),
    subtasks: subtasks
      .filter((s) => s.assignees.some((a) => a.userId === m.user.id))
      .map((s) => ({
        id: s.id,
        text: s.title,
        dueDate: s.dueDate ? s.dueDate.toISOString() : null,
        cardId: s.parentCard!.id,
        cardTitle: s.parentCard!.title,
        boardId: s.parentCard!.column!.board.id,
        boardName: s.parentCard!.column!.board.name,
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
