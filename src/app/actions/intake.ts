"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { Prisma, Role } from "@/generated/prisma/client";
import { getCurrentUser, getActiveMembership } from "@/lib/dal";
import { getIntakeRequestForUser } from "@/lib/authz";
import { createProjectForWorkspace } from "@/lib/projects";
import { checkIntakeThrottle } from "@/lib/intake-throttle";
import { ticketLabel } from "@/lib/intake";
import { enqueueEmail } from "@/lib/queues";
import {
  intakeSubmittedConfirmation,
  newIntakeRequestForAdmin,
  intakeApprovedNotification,
  intakeRejectedNotification,
  withLink,
} from "@/lib/email-templates";
import { appUrl } from "@/lib/app-url";
import { notificationsEnabled } from "@/lib/notify";

const Requester = z.object({
  name: z.string().trim().min(1, "Your name is required").max(140),
  email: z.string().trim().email("Enter a valid email"),
});
const IntakeInput = z.object({
  title: z.string().trim().min(1, "A title is required").max(140),
  description: z.string().trim().min(1, "Tell us what you need").max(4000),
  targetAudience: z.string().trim().max(280).optional(),
  targetDate: z.string().optional(),
});
const Score = z.number().int().min(1).max(5);

function revalidateIntake() {
  revalidatePath("/intake");
  revalidatePath("/", "layout");
}

async function adminGuard() {
  const m = await getActiveMembership();
  if (!m || m.role !== Role.ADMIN) return null;
  return m;
}

// ── Public submission — intentionally the one action in this app with no auth ──

export async function submitIntakeRequest(
  workspaceId: string,
  formData: FormData,
): Promise<{ ok: true; ticket: string } | { error: string }> {
  // Honeypot: real users never see/fill this field. Pretend success so bots
  // don't learn they were caught.
  if (typeof formData.get("website") === "string" && formData.get("website") !== "") {
    return { ok: true as const, ticket: "" };
  }

  const allowed = await checkIntakeThrottle(workspaceId);
  if (!allowed) return { error: "Too many requests from this network — please try again later." };

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true, intakeEnabled: true },
  });
  if (!workspace?.intakeEnabled) return { error: "This intake form is not currently accepting requests." };

  const requester = Requester.safeParse({ name: formData.get("name"), email: formData.get("email") });
  if (!requester.success) return { error: requester.error.issues[0]?.message ?? "Invalid submission." };
  const input = IntakeInput.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    targetAudience: formData.get("targetAudience") || undefined,
    targetDate: formData.get("targetDate") || undefined,
  });
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Invalid submission." };

  const targetDate = input.data.targetDate ? new Date(input.data.targetDate) : null;
  if (targetDate && Number.isNaN(targetDate.getTime())) return { error: "Invalid target date." };

  const me = await getCurrentUser();

  let request;
  try {
    request = await prisma.$transaction(
      async (tx) => {
        const last = await tx.intakeRequest.findFirst({
          where: { workspaceId },
          orderBy: { number: "desc" },
          select: { number: true },
        });
        return tx.intakeRequest.create({
          data: {
            workspaceId,
            number: (last?.number ?? 0) + 1,
            requesterName: requester.data.name,
            requesterEmail: requester.data.email,
            requestedById: me?.id,
            title: input.data.title,
            description: input.data.description,
            targetAudience: input.data.targetAudience || null,
            targetDate,
          },
          select: { number: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch {
    return { error: "Couldn't submit your request — please try again." };
  }

  const ticket = ticketLabel(request.number);
  // The requester confirmation is transactional (a reply to their submission)
  // and always sends; the admin heads-up is gated by the "intake" toggle.
  const notifyAdmins = await notificationsEnabled(workspaceId, "intake");
  const admins = notifyAdmins
    ? await prisma.membership.findMany({
        where: { workspaceId, role: Role.ADMIN },
        select: { user: { select: { email: true } } },
      })
    : [];
  await Promise.all([
    enqueueEmail({
      to: requester.data.email,
      ...intakeSubmittedConfirmation({ ticket, title: input.data.title, workspaceName: workspace.name }),
    }),
    ...admins.map((m) =>
      enqueueEmail({
        to: m.user.email,
        ...withLink(
          newIntakeRequestForAdmin({
            ticket,
            title: input.data.title,
            requesterName: requester.data.name,
            workspaceName: workspace.name,
          }),
          appUrl("/intake"),
        ),
      }),
    ),
  ]);

  revalidateIntake();
  return { ok: true as const, ticket };
}

// ── Triage (authenticated) ──────────────────────────────────────────────────

export async function scoreIntakeRequest(
  requestId: string,
  impact: number,
  effort: number,
): Promise<{ error: string } | undefined> {
  const request = await getIntakeRequestForUser(requestId);
  if (!request) return { error: "Request not found." };
  const impactParsed = Score.safeParse(impact);
  const effortParsed = Score.safeParse(effort);
  if (!impactParsed.success || !effortParsed.success) return { error: "Scores must be 1-5." };

  await prisma.intakeRequest.update({
    where: { id: requestId },
    data: {
      impactScore: impactParsed.data,
      effortScore: effortParsed.data,
      status: request.status === "submitted" ? "triaging" : request.status,
    },
  });
  revalidateIntake();
}

export async function assignIntakeRequest(
  requestId: string,
  userId: string | null,
): Promise<{ error: string } | undefined> {
  const request = await getIntakeRequestForUser(requestId);
  if (!request) return { error: "Request not found." };

  if (userId) {
    const member = await prisma.membership.findFirst({
      where: { userId, workspaceId: request.workspaceId },
      select: { id: true },
    });
    if (!member) return { error: "Must be a workspace member." };
  }

  await prisma.intakeRequest.update({ where: { id: requestId }, data: { assignedToId: userId } });
  revalidateIntake();
}

export async function approveIntakeRequest(
  requestId: string,
): Promise<{ error: string } | { project: { id: string } }> {
  const request = await getIntakeRequestForUser(requestId);
  if (!request) return { error: "Request not found." };
  if (["approved", "converted", "rejected"].includes(request.status)) {
    return { error: "This request has already been resolved." };
  }

  const project = await createProjectForWorkspace(request.workspaceId, request.title, "ADDIE");
  await prisma.intakeRequest.update({
    where: { id: requestId },
    data: { status: "converted", convertedProjectId: project.id },
  });

  await enqueueEmail({
    to: request.requesterEmail,
    ...intakeApprovedNotification({
      ticket: ticketLabel(request.number),
      title: request.title,
      workspaceName: request.workspace.name,
    }),
  });

  revalidateIntake();
  revalidatePath("/projects");
  return { project };
}

export async function rejectIntakeRequest(
  requestId: string,
  reason: string,
): Promise<{ error: string } | undefined> {
  const request = await getIntakeRequestForUser(requestId);
  if (!request) return { error: "Request not found." };
  const rejectionReason = reason.trim() ? reason.trim().slice(0, 500) : null;
  await prisma.intakeRequest.update({
    where: { id: requestId },
    data: { status: "rejected", rejectionReason },
  });

  await enqueueEmail({
    to: request.requesterEmail,
    ...intakeRejectedNotification({
      ticket: ticketLabel(request.number),
      title: request.title,
      workspaceName: request.workspace.name,
      reason: rejectionReason,
    }),
  });

  revalidateIntake();
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function setIntakeEnabled(enabled: boolean): Promise<{ error: string } | undefined> {
  const admin = await adminGuard();
  if (!admin) return { error: "You must be a workspace admin." };
  await prisma.workspace.update({ where: { id: admin.workspaceId }, data: { intakeEnabled: enabled } });
  revalidatePath("/settings/intake");
}
