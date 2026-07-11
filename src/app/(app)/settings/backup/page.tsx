import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/dal";
import { Role } from "@/generated/prisma/client";
import { BackupPanel } from "@/components/settings/backup-panel";

export const metadata = { title: "Backup · IDStudio" };

export default async function BackupSettingsPage() {
  const membership = await getActiveMembership();
  if (!membership || membership.role !== Role.ADMIN) redirect("/settings/account");
  return <BackupPanel workspaceName={membership.workspace.name} />;
}
