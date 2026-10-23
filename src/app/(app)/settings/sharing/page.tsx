import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/dal";
import { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { shareUrl } from "@/lib/board-share";
import { SharingPanel } from "@/components/settings/sharing-panel";

export const metadata = { title: "Sharing · Tavoro" };

export default async function SharingSettingsPage() {
  const membership = await getActiveMembership();
  if (!membership || membership.role !== Role.ADMIN) redirect("/settings/account");

  const [workspace, boards] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: membership.workspaceId }, select: { publicBoardsEnabled: true } }),
    prisma.board.findMany({
      where: { workspaceId: membership.workspaceId, publicNonce: { not: null } },
      orderBy: { publicSharedAt: "desc" },
      select: {
        id: true,
        name: true,
        publicNonce: true,
        publicShowAssignees: true,
        publicSharedAt: true,
        publicSharedBy: { select: { name: true, email: true } },
      },
    }),
  ]);

  return (
    <SharingPanel
      enabled={workspace!.publicBoardsEnabled}
      boards={boards.map((b) => ({
        id: b.id,
        name: b.name,
        url: shareUrl({ id: b.id, publicNonce: b.publicNonce! }),
        showAssignees: b.publicShowAssignees,
        sharedAt: b.publicSharedAt?.toISOString() ?? null,
        sharedBy: b.publicSharedBy ? (b.publicSharedBy.name ?? b.publicSharedBy.email) : null,
      }))}
    />
  );
}
