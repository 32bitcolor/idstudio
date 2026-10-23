import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveMembership, requireUser } from "@/lib/dal";
import { intakeVisibilityWhere } from "@/lib/authz";
import { canDecideIntake, isResolved, priorityScore } from "@/lib/intake";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { EmptyState } from "@/components/shared/empty-state";
import { TriageQueue } from "@/components/intake/triage-queue";

export const metadata = { title: "Intake · Tavoro" };

export default async function IntakePage() {
  const me = await requireUser();
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");
  const decide = canDecideIntake(membership.role);

  const [requests, members] = await Promise.all([
    prisma.intakeRequest.findMany({
      where: { workspaceId: membership.workspaceId, ...(await intakeVisibilityWhere()) },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        number: true,
        title: true,
        requesterName: true,
        requesterEmail: true,
        targetDate: true,
        impactScore: true,
        effortScore: true,
        status: true,
        assignedToId: true,
        convertedProjectId: true,
        createdAt: true,
        decidedAt: true,
      },
    }),
    prisma.membership.findMany({
      where: { workspaceId: membership.workspaceId, suspendedAt: null },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  // Open requests: untriaged first (they need attention before anything else), then
  // by priority score, highest first. Decided ones: most recently decided first.
  const sorted = [...requests].sort((a, b) => {
    if (isResolved(a.status) || isResolved(b.status)) {
      return (b.decidedAt ?? b.createdAt).getTime() - (a.decidedAt ?? a.createdAt).getTime();
    }
    const aScored = a.impactScore != null && a.effortScore != null;
    const bScored = b.impactScore != null && b.effortScore != null;
    if (aScored !== bScored) return aScored ? 1 : -1;
    if (!aScored) return b.createdAt.getTime() - a.createdAt.getTime();
    return priorityScore(b.impactScore!, b.effortScore!) - priorityScore(a.impactScore!, a.effortScore!);
  });

  return (
    <PageContainer>
      <PageHeader
        title="Intake"
        description={
          decide
            ? "Stakeholder requests, triaged and scored by impact vs. effort."
            : "Stakeholder requests and where they stand. Admins and managers triage them; you can score the ones assigned to you."
        }
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
            requests={sorted.map((r) => ({
              id: r.id,
              number: r.number,
              title: r.title,
              requesterName: r.requesterName,
              // Requester emails are for admins and managers only.
              requesterEmail: decide ? r.requesterEmail : null,
              targetDate: r.targetDate?.toISOString() ?? null,
              impactScore: r.impactScore,
              effortScore: r.effortScore,
              status: r.status,
              assignedToId: r.assignedToId,
              convertedProjectId: r.convertedProjectId,
            }))}
            members={members.map((m) => m.user)}
            viewer={{ id: me.id, role: membership.role, decide }}
          />
        </div>
      )}
    </PageContainer>
  );
}
