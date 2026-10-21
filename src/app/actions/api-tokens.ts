"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getActiveMembership, getCurrentUser } from "@/lib/dal";
import { createPersonalToken, SCOPES } from "@/lib/api-tokens";
import { currentPrincipal } from "@/lib/principal";
import { Role } from "@/generated/prisma/client";

// Settings → AI & MCP (docs/MCP.md). Tokens are made from the browser only: an MCP
// connection can't mint itself more credentials.

const Input = z.object({
  name: z.string().trim().min(1, "Give the token a name.").max(80),
  scope: z.enum(SCOPES),
  expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365), z.null()]),
});

export async function createApiToken(input: z.input<typeof Input>) {
  if (currentPrincipal()) return { error: "Tokens can only be created in the app." };
  const membership = await getActiveMembership();
  if (!membership) return { error: "Not signed in." };
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid token settings." };
  const { token } = await createPersonalToken({
    userId: membership.userId,
    workspaceId: membership.workspaceId,
    name: parsed.data.name,
    scope: parsed.data.scope,
    expiresAt: parsed.data.expiresInDays ? new Date(Date.now() + parsed.data.expiresInDays * 86_400_000) : null,
  });
  revalidatePath("/settings/ai");
  return { token };
}

/** Revoke one of your own tokens or connections; admins can revoke anyone's in their workspace. */
export async function revokeApiToken(id: string) {
  if (currentPrincipal()) return { error: "Tokens can only be managed in the app." };
  const me = await getCurrentUser();
  const membership = await getActiveMembership();
  if (!me || !membership) return { error: "Not signed in." };
  const row = await prisma.apiToken.findUnique({ where: { id }, select: { userId: true, workspaceId: true } });
  const allowed = row && (row.userId === me.id || (membership.role === Role.ADMIN && row.workspaceId === membership.workspaceId));
  if (!allowed) return { error: "Token not found." };
  await prisma.apiToken.update({ where: { id }, data: { revokedAt: new Date() } });
  revalidatePath("/settings/ai");
}
