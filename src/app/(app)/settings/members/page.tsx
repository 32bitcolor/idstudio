import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { Role } from "@/generated/prisma/client";
import { MembersManager } from "@/components/settings/members-manager";

export const metadata = { title: "Members · Tavoro" };

export default async function MembersPage() {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");
  if (membership.role !== Role.ADMIN) redirect("/settings/account");

  const rows = await prisma.membership.findMany({
    where: { workspaceId: membership.workspaceId },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      suspendedAt: true,
      user: { select: { id: true, email: true, name: true, ssoIdentities: { where: { connection: { workspaceId: membership.workspaceId } }, select: { id: true } } } },
    },
  });
  const sso = await prisma.ssoConnection.findUnique({ where: { workspaceId: membership.workspaceId }, select: { manageRoles: true } });

  const members = rows.map((r) => ({
    id: r.user.id,
    email: r.user.email,
    name: r.user.name,
    role: r.role,
    isSelf: r.user.id === membership.userId,
    sso: r.user.ssoIdentities.length > 0,
    suspended: !!r.suspendedAt,
    // Roles from identity-provider groups overwrite manual changes on the next sync.
    roleManaged: !!sso?.manageRoles && r.user.ssoIdentities.length > 0,
  }));

  return <MembersManager members={members} />;
}
