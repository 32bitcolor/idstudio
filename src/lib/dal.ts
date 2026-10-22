import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { currentPrincipal } from "@/lib/principal";
import { Role, type Prisma } from "@/generated/prisma/client";

// Data Access Layer — every protected read/mutation resolves identity through here.
// `cache` memoizes within a single render pass so repeated calls hit the DB once.

export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session?.userId) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true },
  });
});

export const requireUser = cache(async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
});

/** Workspaces that require SSO are closed to a password session, except to their
 *  admins (the way back in if the identity provider is down). MCP tokens were issued
 *  from a session that passed this check, so they aren't held to it again. */
function ssoBlocks(): Prisma.MembershipWhereInput {
  return { NOT: { role: { not: Role.ADMIN }, workspace: { ssoConnection: { is: { enabled: true, requireSso: true } } } } };
}

// A user's "active" workspace: the one pinned in their session if they're still a
// member, otherwise their oldest membership. (Most users have exactly one.)
export const getActiveMembership = cache(async () => {
  const user = await requireUser();
  const session = await getSession();
  const allowed = currentPrincipal() || session?.sso ? {} : ssoBlocks();
  if (session?.activeWorkspaceId) {
    const pinned = await prisma.membership.findFirst({
      where: { userId: user.id, workspaceId: session.activeWorkspaceId, suspendedAt: null, ...allowed },
      include: { workspace: true },
    });
    if (pinned) return pinned;
    // An MCP token never falls back to another workspace.
    if (currentPrincipal()) return null;
  }
  return prisma.membership.findFirst({
    where: { userId: user.id, suspendedAt: null, ...allowed },
    orderBy: { createdAt: "asc" },
    include: { workspace: true },
  });
});

export async function requireAdmin() {
  const membership = await getActiveMembership();
  if (!membership || membership.role !== Role.ADMIN) {
    redirect("/dashboard");
  }
  return membership;
}
