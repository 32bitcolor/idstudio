import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { getIntakeRequestForUser } from "@/lib/authz";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { RequestDetail } from "@/components/intake/request-detail";

export const metadata = { title: "Request · IDStudio" };

export default async function IntakeRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");

  const { id } = await params;
  const request = await getIntakeRequestForUser(id);
  if (!request) notFound();

  const members = await prisma.membership.findMany({
    where: { workspaceId: membership.workspaceId },
    select: { user: { select: { id: true, name: true, email: true } } },
  });

  return (
    <PageContainer size="wide">
      <PageHeader eyebrow={membership.workspace.name} title={request.title} />
      <div className="mt-6">
        <RequestDetail
          request={{ ...request, targetDate: request.targetDate?.toISOString() ?? null }}
          members={members.map((m) => m.user)}
        />
      </div>
    </PageContainer>
  );
}
