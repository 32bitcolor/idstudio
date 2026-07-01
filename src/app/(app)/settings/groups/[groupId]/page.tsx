import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { Role } from "@/generated/prisma/client";
import { GroupDetail } from "@/components/settings/group-detail";

export const metadata = { title: "Group · IDStudio" };

export default async function GroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");
  if (membership.role !== Role.ADMIN) redirect("/settings/account");

  const group = await prisma.group.findFirst({
    where: { id: groupId, workspaceId: membership.workspaceId },
    select: {
      id: true,
      name: true,
      description: true,
      members: { select: { user: { select: { id: true, email: true, name: true } } } },
    },
  });
  if (!group) notFound();

  const [workspaceMembers, boards, storyboards, projects] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { createdAt: "asc" },
      select: { user: { select: { id: true, email: true, name: true } } },
    }),
    prisma.board.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, groupAccess: { where: { groupId }, select: { groupId: true } } },
    }),
    prisma.storyboard.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { title: "asc" },
      select: { id: true, title: true, groupAccess: { where: { groupId }, select: { groupId: true } } },
    }),
    prisma.project.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, groupAccess: { where: { groupId }, select: { groupId: true } } },
    }),
  ]);

  const inGroupIds = new Set(group.members.map((m) => m.user.id));
  const members = group.members.map((m) => m.user);
  const candidates = workspaceMembers.map((w) => w.user).filter((u) => !inGroupIds.has(u.id));

  const resources = {
    board: boards.map((b) => ({ id: b.id, name: b.name, granted: b.groupAccess.length > 0 })),
    storyboard: storyboards.map((s) => ({ id: s.id, name: s.title, granted: s.groupAccess.length > 0 })),
    project: projects.map((p) => ({ id: p.id, name: p.name, granted: p.groupAccess.length > 0 })),
  };

  return (
    <GroupDetail
      group={{ id: group.id, name: group.name, description: group.description }}
      members={members}
      candidates={candidates}
      resources={resources}
    />
  );
}
