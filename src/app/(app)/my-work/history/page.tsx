import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, History, RotateCcw } from "lucide-react";

import { prisma } from "@/lib/db";
import { requireUser, getActiveMembership } from "@/lib/dal";
import { projectVisibilityWhere } from "@/lib/authz";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { artifactLink, DELIVERABLE_SELECT } from "@/components/my-work/artifact";

export const metadata = { title: "Review History · IDStudio" };

// Resolved review outcomes surface here (kept off the active Overview tab).
const RESOLVED = ["approved", "changes_requested"] as const;
const fmtDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function ReviewHistoryPage() {
  const me = await requireUser();
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");
  const projectVis = await projectVisibilityWhere();

  const history = await prisma.reviewCycle.findMany({
    where: {
      OR: [{ reviewerId: me.id }, { requestedById: me.id }],
      status: { in: [...RESOLVED] },
      deliverable: { project: { workspaceId: membership.workspaceId, ...projectVis } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true, round: true, status: true, updatedAt: true, feedback: true, reviewerId: true,
      reviewer: { select: { name: true, email: true } },
      requestedBy: { select: { name: true, email: true } },
      deliverable: { select: DELIVERABLE_SELECT },
    },
  });

  if (history.length === 0) {
    return (
      <EmptyState
        className="mt-4"
        icon={History}
        title="No review history yet"
        description="Once reviews are approved or sent back for changes, they'll appear here — a running record of what you've reviewed and requested."
      />
    );
  }

  return (
    <Card className="divide-y divide-border p-0">
      {history.map((r) => {
        const link = artifactLink(r.deliverable);
        const iReviewed = r.reviewerId === me.id;
        const other = iReviewed
          ? (r.requestedBy?.name ?? r.requestedBy?.email ?? null)
          : (r.reviewer?.name ?? r.reviewer?.email ?? null);
        const approved = r.status === "approved";
        return (
          <div key={r.id} className="px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              {approved
                ? <Check className="size-4 shrink-0 text-green-600" />
                : <RotateCcw className="size-4 shrink-0 text-amber-600" />}
              <div className="min-w-0 flex-1">
                <Link href={link.href} className="truncate font-medium hover:underline">
                  {r.deliverable.name}
                </Link>
                <div className="truncate text-sm text-muted-foreground">
                  {r.deliverable.project.name} · {link.label} · round {r.round} ·{" "}
                  {iReviewed ? "you reviewed" : "you requested"}
                  {other ? ` · ${iReviewed ? "for" : "reviewer"} ${other}` : ""}
                </div>
              </div>
              <StatusBadge tone={approved ? "success" : "warning"}>
                {approved ? "Approved" : "Changes requested"}
              </StatusBadge>
              <span className="shrink-0 text-xs text-muted-foreground">{fmtDate.format(r.updatedAt)}</span>
            </div>
            {r.feedback && (
              <p className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                “{r.feedback}”
              </p>
            )}
          </div>
        );
      })}
    </Card>
  );
}
