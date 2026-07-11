import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/dal";
import { Role } from "@/generated/prisma/client";
import { readUpdateStatus } from "@/lib/updater";
import { UpdatePanel } from "@/components/settings/update-panel";

export const metadata = { title: "Updates · IDStudio" };

export default async function UpdatesSettingsPage() {
  const membership = await getActiveMembership();
  if (!membership || membership.role !== Role.ADMIN) redirect("/settings/account");
  const initial = await readUpdateStatus();
  return <UpdatePanel initial={initial} />;
}
