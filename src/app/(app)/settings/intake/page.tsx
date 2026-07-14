import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/dal";
import { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { IntakeLinkPanel } from "@/components/settings/intake-link-panel";

export const metadata = { title: "Intake · IDStudio" };

export default async function IntakeSettingsPage() {
  const membership = await getActiveMembership();
  if (!membership || membership.role !== Role.ADMIN) redirect("/settings/account");

  const workspace = await prisma.workspace.findUnique({
    where: { id: membership.workspaceId },
    select: { slug: true, intakeEnabled: true },
  });

  return <IntakeLinkPanel slug={workspace!.slug} intakeEnabled={workspace!.intakeEnabled} />;
}
