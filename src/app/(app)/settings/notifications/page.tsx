import { redirect } from "next/navigation";
import { getActiveMembership, getCurrentUser } from "@/lib/dal";
import { Role } from "@/generated/prisma/client";
import { getEmailConfigured } from "@/app/actions/notifications";
import { NotificationsPanel } from "@/components/settings/notifications-panel";

export const metadata = { title: "Notifications · IDStudio" };

export default async function NotificationsSettingsPage() {
  const membership = await getActiveMembership();
  if (!membership || membership.role !== Role.ADMIN) redirect("/settings/account");
  const [configured, user] = await Promise.all([getEmailConfigured(), getCurrentUser()]);
  return <NotificationsPanel configured={configured} defaultTo={user?.email ?? ""} />;
}
