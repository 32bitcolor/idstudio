import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { Role } from "@/generated/prisma/client";
import { GroupsManager } from "@/components/settings/groups-manager";

export const metadata = { title: "Groups · IDStudio" };

export default async function GroupsPage() {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");
  if (membership.role !== Role.ADMIN) redirect("/settings/account");

  const groups = await prisma.group.findMany({
    where: { workspaceId: membership.workspaceId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      _count: { select: { members: true, boards: true, storyboards: true, projects: true } },
    },
  });

  const rows = groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    memberCount: g._count.members,
    sharedCount: g._count.boards + g._count.storyboards + g._count.projects,
  }));

  return <GroupsManager groups={rows} />;
}
