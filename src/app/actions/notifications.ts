"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser, getActiveMembership } from "@/lib/dal";
import { Role } from "@/generated/prisma/client";
import { sendMail } from "@/lib/mailer";
import {
  NOTIFICATION_TYPES,
  notificationSettingsMap,
  sanitizeNotificationSettings,
  type NotificationType,
} from "@/lib/notifications";

/** Whether outbound email is configured (SMTP_HOST set). Read by the settings UI. */
export async function getEmailConfigured(): Promise<boolean> {
  return Boolean(process.env.SMTP_HOST);
}

/** Admin: the workspace's per-type notification toggles as a full map (all types → boolean). */
export async function getNotificationSettings(): Promise<Record<NotificationType, boolean> | null> {
  const m = await getActiveMembership();
  if (!m || m.role !== Role.ADMIN) return null;
  const ws = await prisma.workspace.findUnique({
    where: { id: m.workspaceId },
    select: { notificationSettings: true },
  });
  return notificationSettingsMap(ws?.notificationSettings);
}

/** Admin: enable or disable one notification type for the workspace. */
export async function setNotificationEnabled(type: string, enabled: boolean) {
  const m = await getActiveMembership();
  if (!m || m.role !== Role.ADMIN) return { error: "Admins only." };
  if (!NOTIFICATION_TYPES.some((t) => t.key === type)) return { error: "Unknown notification type." };

  const ws = await prisma.workspace.findUnique({
    where: { id: m.workspaceId },
    select: { notificationSettings: true },
  });
  const current =
    ws?.notificationSettings && typeof ws.notificationSettings === "object" && !Array.isArray(ws.notificationSettings)
      ? (ws.notificationSettings as Record<string, unknown>)
      : {};
  const next = sanitizeNotificationSettings({ ...current, [type]: enabled });

  await prisma.workspace.update({ where: { id: m.workspaceId }, data: { notificationSettings: next } });
  revalidatePath("/settings/notifications");
  return { success: true as const };
}

/** Admin-only: send a synchronous test email so SMTP can be verified on demand.
 *  Sends directly (not via the queue) so the real success/failure is returned. */
export async function sendTestEmail(to?: string) {
  const m = await getActiveMembership();
  if (!m || m.role !== Role.ADMIN) return { error: "Admins only." };
  if (!process.env.SMTP_HOST) {
    return { error: "SMTP is not configured — set the SMTP_* env vars and restart." };
  }

  const user = await getCurrentUser();
  const recipient = (to && to.trim()) || user?.email || "";
  const parsed = z.string().email().safeParse(recipient);
  if (!parsed.success) return { error: "Enter a valid recipient email." };

  try {
    await sendMail({
      to: parsed.data,
      subject: "IDStudio test email",
      html: "<p>✅ Your IDStudio email notifications are configured correctly.</p><p>This is a test message from <strong>Settings → Notifications</strong>.</p>",
      text: "Your IDStudio email notifications are configured correctly. This is a test message from Settings → Notifications.",
    });
    return { success: `Test email sent to ${parsed.data}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to send — check the SMTP settings." };
  }
}
