"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";
import { SignupSchema, LoginSchema } from "@/lib/validation";
import { slugify } from "@/lib/slug";
import { Role } from "@/generated/prisma/client";
import type { AuthState } from "@/lib/form-state";

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
    select: { id: true },
  });

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

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
