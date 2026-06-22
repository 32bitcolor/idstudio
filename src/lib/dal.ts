import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { Role } from "@/generated/prisma/client";

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

// Phase 0: a user's "active" workspace is their first (and only) membership.
export const getActiveMembership = cache(async () => {
  const user = await requireUser();
  return prisma.membership.findFirst({
    where: { userId: user.id },
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
