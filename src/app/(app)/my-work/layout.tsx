import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/dal";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { MyWorkNav } from "@/components/my-work/my-work-nav";

export default async function MyWorkLayout({ children }: { children: React.ReactNode }) {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");

  return (
    <PageContainer>
      <PageHeader
        eyebrow={membership.workspace.name}
        title="My Work"
        description="Your reviews, action items, milestones, and review history."
      />
      <MyWorkNav />
      <div className="mt-6">{children}</div>
    </PageContainer>
  );
}
