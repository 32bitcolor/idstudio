import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { intakeVisibilityWhere } from "@/lib/authz";
import { priorityScore } from "@/lib/intake";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { EmptyState } from "@/components/shared/empty-state";
import { TriageQueue } from "@/components/intake/triage-queue";

export const metadata = { title: "Intake · IDStudio" };

export default async function IntakePage() {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");

  const [requests, members] = await Promise.all([
    prisma.intakeRequest.findMany({
      where: { workspaceId: membership.workspaceId, ...(await intakeVisibilityWhere()) },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        number: true,
        title: true,
        description: true,
        requesterName: true,
        requesterEmail: true,
        targetDate: true,
        impactScore: true,
        effortScore: true,
        status: true,
        assignedToId: true,
        convertedProjectId: true,
        createdAt: true,
      },
    }),
    prisma.membership.findMany({
      where: { workspaceId: membership.workspaceId },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  // Untriaged first (they need attention before anything else), then by
  // priority score, highest first, among everything that's been scored.
  const sorted = [...requests].sort((a, b) => {
    const aScored = a.impactScore != null && a.effortScore != null;
    const bScored = b.impactScore != null && b.effortScore != null;
    if (aScored !== bScored) return aScored ? 1 : -1;
    if (!aScored) return b.createdAt.getTime() - a.createdAt.getTime();
    return priorityScore(b.impactScore!, b.effortScore!) - priorityScore(a.impactScore!, a.effortScore!);
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow={membership.workspace.name}
        title="Intake"
        description="Stakeholder requests, triaged and scored by impact vs. effort."
      />

      {sorted.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={Inbox}
          title="No requests yet"
          description="Share your public intake link (Settings → Intake) so stakeholders can submit requests here."
        />
      ) : (
        <div className="mt-6">
          <TriageQueue
            requests={sorted.map((r) => ({ ...r, targetDate: r.targetDate?.toISOString() ?? null }))}
            members={members.map((m) => m.user)}
          />
        </div>
      )}
    </PageContainer>
  );
}
