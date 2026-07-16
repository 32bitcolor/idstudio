import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { SprintsManager } from "@/components/sprint/sprints-manager";

export const metadata = { title: "Sprints · IDStudio" };

export default async function SprintsPage() {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");

  const sprints = await prisma.sprint.findMany({
    where: { workspaceId: membership.workspaceId },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      goal: true,
      status: true,
      startDate: true,
      endDate: true,
      _count: { select: { cards: true } },
    },
  });

  const initial = sprints.map((s) => ({
    id: s.id,
    name: s.name,
    goal: s.goal,
    status: s.status,
    startDate: s.startDate ? s.startDate.toISOString().slice(0, 10) : null,
    endDate: s.endDate ? s.endDate.toISOString().slice(0, 10) : null,
    cardCount: s._count.cards,
  }));

  return (
    <PageContainer>
      <PageHeader
        eyebrow={membership.workspace.name}
        title="Sprints"
        description="Plan time-boxed sprints across projects, then open the board to run them."
      />
      <SprintsManager initial={initial} />
    </PageContainer>
  );
}
