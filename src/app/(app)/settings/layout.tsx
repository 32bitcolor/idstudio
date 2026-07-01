import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/dal";
import { Role } from "@/generated/prisma/client";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { SettingsNav } from "@/components/settings/settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");
  const isAdmin = membership.role === Role.ADMIN;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={membership.workspace.name}
        title="Settings"
        description="Manage your account, workspace members, and groups."
      />
      <SettingsNav isAdmin={isAdmin} />
      <div className="mt-6">{children}</div>
    </PageContainer>
  );
}
