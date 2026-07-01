import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { Role } from "@/generated/prisma/client";
import { MembersManager } from "@/components/settings/members-manager";

export const metadata = { title: "Members · IDStudio" };

export default async function MembersPage() {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");
  if (membership.role !== Role.ADMIN) redirect("/settings/account");

  const rows = await prisma.membership.findMany({
    where: { workspaceId: membership.workspaceId },
    orderBy: { createdAt: "asc" },
    select: { role: true, user: { select: { id: true, email: true, name: true } } },
  });

  const members = rows.map((r) => ({
    id: r.user.id,
    email: r.user.email,
    name: r.user.name,
    role: r.role,
    isSelf: r.user.id === membership.userId,
  }));

  return <MembersManager members={members} />;
}
