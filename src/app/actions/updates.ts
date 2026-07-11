"use server";

import { getActiveMembership } from "@/lib/dal";
import { Role } from "@/generated/prisma/client";
import { readUpdateStatus, writeUpdateRequest, type UpdateStatus } from "@/lib/updater";

async function requireWorkspaceAdmin() {
  const membership = await getActiveMembership();
  if (!membership || membership.role !== Role.ADMIN) throw new Error("Forbidden");
  return membership;
}

export async function getUpdateStatus(): Promise<UpdateStatus | null> {
  await requireWorkspaceAdmin();
  return readUpdateStatus();
}

export async function checkForUpdates() {
  await requireWorkspaceAdmin();
  await writeUpdateRequest("check");
  return { ok: true };
}

export async function applyUpdate() {
  await requireWorkspaceAdmin();
  await writeUpdateRequest("update");
  return { ok: true };
}

export async function rollbackUpdate() {
  await requireWorkspaceAdmin();
  await writeUpdateRequest("rollback");
  return { ok: true };
}
