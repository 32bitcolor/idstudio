"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";
import { SignupSchema, LoginSchema } from "@/lib/validation";
import { slugify } from "@/lib/slug";
import { workspaceStatusSeedData } from "@/lib/status";
import { Role } from "@/generated/prisma/client";
import type { AuthState } from "@/lib/form-state";
import { connectionForEmail } from "@/lib/sso/connection";

async function uniqueWorkspaceSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const taken = await prisma.workspace.findUnique({ where: { slug }, select: { id: true } });
    if (!taken) return slug;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = SignupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    workspaceName: formData.get("workspaceName"),
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const { name, password, workspaceName } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const passwordHash = await hashPassword(password);
  const slug = await uniqueWorkspaceSlug(workspaceName);

  // First user of a new workspace is its ADMIN.
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      memberships: {
        create: {
          role: Role.ADMIN,
          workspace: { create: { name: workspaceName, slug } },
        },
      },
    },
    select: { id: true, memberships: { select: { workspaceId: true }, take: 1 } },
  });

  // Seed the new workspace's canonical status vocabulary.
  const workspaceId = user.memberships[0]?.workspaceId;
  if (workspaceId) {
    await prisma.workspaceStatus.createMany({ data: workspaceStatusSeedData(workspaceId) });
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  // Same message whether the email is unknown or the password is wrong.
  if (!user || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
    return { error: "Invalid email or password." };
  }

  // Suspended everywhere, or only in workspaces that require single sign-on?
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { workspaceId: true, role: true, suspendedAt: true, workspace: { select: { ssoConnection: { select: { enabled: true, requireSso: true } } } } },
  });
  const active = memberships.filter((m) => !m.suspendedAt);
  if (memberships.length && !active.length) return { error: "Your access has been turned off. Ask your workspace admin." };
  const open = active.filter((m) => m.role === Role.ADMIN || !(m.workspace.ssoConnection?.enabled && m.workspace.ssoConnection.requireSso));
  if (active.length && !open.length) return { error: "Your workspace signs in with single sign-on. Choose “Sign in with SSO”." };

  await createSession(user.id, open[0]?.workspaceId, { sso: false });
  redirect(safeNext(formData.get("next")) ?? "/dashboard");
}

/** A same-site path to go to after signing in; anything else is ignored, so the
 *  parameter can't send someone to another site. */
function safeNext(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  return raw.length <= 2000 ? raw : null;
}

/** "Sign in with SSO": the identity provider for the email's domain. */
export async function startSso(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { fieldErrors: { email: ["Enter your work email first."] } };
  const conn = await connectionForEmail(email);
  if (!conn) return { error: "Single sign-on isn't set up for that email's domain." };
  const next = safeNext(formData.get("next"));
  redirect(`/api/sso/${conn.id}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
