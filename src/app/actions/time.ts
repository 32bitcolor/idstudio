"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { getProjectForUser, getTimeEntryForUser } from "@/lib/authz";

function projectPath(projectId: string) {
  return `/projects/${projectId}`;
}

export async function addTimeEntry(
  projectId: string,
  deliverableId: string | null,
  minutes: number,
  loggedForIso: string | null,
  note: string,
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized." };
  const project = await getProjectForUser(projectId);
  if (!project) return { error: "Project not found." };

  const mins = Math.round(Number(minutes));
  if (!Number.isFinite(mins) || mins <= 0 || mins > 24 * 60) return { error: "Enter a valid duration." };
  const loggedFor = loggedForIso ? new Date(loggedForIso) : new Date();
  if (Number.isNaN(loggedFor.getTime())) return { error: "Invalid date." };

  if (deliverableId) {
    const d = await prisma.deliverable.findFirst({ where: { id: deliverableId, projectId }, select: { id: true } });
    if (!d) return { error: "Deliverable not found." };
  }

  const entry = await prisma.timeEntry.create({
    data: {
      projectId,
      deliverableId: deliverableId || null,
      userId: user.id,
      minutes: mins,
      note: note.trim() ? note.trim().slice(0, 500) : null,
      loggedFor,
    },
    select: {
      id: true,
      minutes: true,
      note: true,
      loggedFor: true,
      user: { select: { id: true, name: true, email: true } },
      deliverable: { select: { id: true, name: true } },
    },
  });
  revalidatePath(projectPath(projectId));
  return {
    entry: {
      id: entry.id,
      minutes: entry.minutes,
      note: entry.note,
      loggedFor: entry.loggedFor.toISOString(),
      user: entry.user,
      deliverable: entry.deliverable,
    },
  };
}

export async function deleteTimeEntry(id: string) {
  const t = await getTimeEntryForUser(id);
  if (!t) return { error: "Entry not found." };
  await prisma.timeEntry.delete({ where: { id } });
  revalidatePath(projectPath(t.projectId));
}
