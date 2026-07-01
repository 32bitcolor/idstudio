"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { hashPassword } from "@/lib/password";
import { CreateUserSchema, ResetPasswordSchema } from "@/lib/validation";
import { Role } from "@/generated/prisma/client";
import type { FormState } from "@/lib/form-state";

// Resolve the caller's admin membership, or null if they aren't an admin here.
async function adminGuard() {
  const m = await getActiveMembership();
  if (!m || m.role !== Role.ADMIN) return null;
  return m;
}

/** Admin: create a workspace member with an admin-set initial password. */
export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await adminGuard();
  if (!admin) return { error: "You must be a workspace admin." };

  const parsed = CreateUserSchema.safeParse({
    name: formData.get("name") || undefined,
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  if (existing) {
    const already = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: existing.id, workspaceId: admin.workspaceId } },
      select: { userId: true },
    });
    if (already) return { error: "A user with that email is already in this workspace." };
    await prisma.membership.create({
      data: { userId: existing.id, workspaceId: admin.workspaceId, role: parsed.data.role },
    });
    revalidatePath("/settings/members");
    return { success: `Added ${email} to the workspace.` };
  }

  await prisma.user.create({
    data: {
      email,
      name: parsed.data.name || null,
      passwordHash: await hashPassword(parsed.data.password),
      memberships: { create: { workspaceId: admin.workspaceId, role: parsed.data.role } },
    },
  });
  revalidatePath("/settings/members");
  return { success: `Created ${email}. Share the password with them securely.` };
}

/** Admin: change a member's role, protecting the last admin. */
export async function setUserRole(userId: string, role: string) {
  const admin = await adminGuard();
  if (!admin) return { error: "You must be a workspace admin." };
  const parsed = z.enum(["ADMIN", "MEMBER"]).safeParse(role);
  if (!parsed.success) return { error: "Invalid role." };

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: admin.workspaceId } },
    select: { role: true },
  });
  if (!membership) return { error: "User not found in this workspace." };

  if (membership.role === Role.ADMIN && parsed.data === "MEMBER") {
    const admins = await prisma.membership.count({
      where: { workspaceId: admin.workspaceId, role: Role.ADMIN },
    });
    if (admins <= 1) return { error: "You can't demote the last admin." };
  }

  await prisma.membership.update({
    where: { userId_workspaceId: { userId, workspaceId: admin.workspaceId } },
    data: { role: parsed.data },
  });
  revalidatePath("/settings/members");
}

/** Admin: set a new password for a member (shared out-of-band). */
export async function resetUserPassword(userId: string, password: string): Promise<FormState> {
  const admin = await adminGuard();
  if (!admin) return { error: "You must be a workspace admin." };
  const parsed = ResetPasswordSchema.safeParse({ password });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: admin.workspaceId } },
    select: { userId: true },
  });
  if (!membership) return { error: "User not found in this workspace." };

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });
  return { success: "Password reset. Share the new password securely." };
}

/**
 * Admin: remove a member from the workspace. Deletes the user record entirely if
 * they belong to no other workspace. Protects self-removal and the last admin.
 */
export async function removeUser(userId: string) {
  const admin = await adminGuard();
  if (!admin) return { error: "You must be a workspace admin." };
  if (userId === admin.userId) return { error: "You can't remove yourself." };

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: admin.workspaceId } },
    select: { role: true },
  });
  if (!membership) return { error: "User not found in this workspace." };

  if (membership.role === Role.ADMIN) {
    const admins = await prisma.membership.count({
      where: { workspaceId: admin.workspaceId, role: Role.ADMIN },
    });
    if (admins <= 1) return { error: "You can't remove the last admin." };
  }

  await prisma.membership.delete({
    where: { userId_workspaceId: { userId, workspaceId: admin.workspaceId } },
  });
  const remaining = await prisma.membership.count({ where: { userId } });
  if (remaining === 0) await prisma.user.delete({ where: { id: userId } });

  revalidatePath("/settings/members");
}
