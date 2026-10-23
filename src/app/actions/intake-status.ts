"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { Role } from "@/generated/prisma/client";
import { requestForStatusToken } from "@/lib/intake-status";
import { checkThrottle, clientIp } from "@/lib/throttle";
import { ticketLabel, triageStatusFor } from "@/lib/intake";
import { enqueueEmail } from "@/lib/queues";
import { intakeRequesterReplied, withLink } from "@/lib/email-templates";
import { appUrl } from "@/lib/app-url";
import { notificationsEnabled } from "@/lib/notify";

// The requester's side of the conversation (lib/intake-status.ts). No sign-in: the
// status link is the credential, checked on every call, and replies are rate-limited.

const Body = z.string().trim().min(1, "Write a reply first.").max(5000, "Keep it under 5,000 characters.");

export async function replyAsRequester(token: string, body: string): Promise<{ error: string } | { ok: true }> {
  const r = await requestForStatusToken(token);
  if (!r) return { error: "This link isn't valid any more. Ask the team for a new one." };
  if (!(await checkThrottle(`intake-reply:${r.id}:${await clientIp()}`, 20, 3600))) {
    return { error: "That's a lot of replies. Please try again in a while." };
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid reply." };

  await prisma.intakeMessage.create({ data: { requestId: r.id, kind: "reply", fromRequester: true, body: parsed.data } });
  // They answered: a request waiting on them goes back to triage.
  if (r.status === "needs_info") {
    await prisma.intakeRequest.update({ where: { id: r.id }, data: { status: triageStatusFor(r) } });
  }

  // Tell whoever owns it: the assignee, or else the workspace's admins and managers.
  if (await notificationsEnabled(r.workspaceId, "intake")) {
    const recipients = r.assignedToId
      ? await prisma.user.findMany({
          where: { id: r.assignedToId, memberships: { some: { workspaceId: r.workspaceId, suspendedAt: null } } },
          select: { email: true },
        })
      : (
          await prisma.membership.findMany({
            where: { workspaceId: r.workspaceId, role: { in: [Role.ADMIN, Role.MANAGER] }, suspendedAt: null },
            select: { user: { select: { email: true } } },
          })
        ).map((m) => m.user);
    for (const u of recipients) {
      await enqueueEmail({
        to: u.email,
        ...withLink(
          intakeRequesterReplied({ ticket: ticketLabel(r.number), title: r.title, requesterName: r.requesterName, body: parsed.data }),
          appUrl(`/intake/${r.id}`),
        ),
      });
    }
  }

  revalidatePath(`/status/${token}`);
  revalidatePath(`/intake/${r.id}`);
  revalidatePath("/intake");
  return { ok: true };
}
