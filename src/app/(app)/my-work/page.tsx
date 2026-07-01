import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, Columns3, Flag, Send } from "lucide-react";

import { prisma } from "@/lib/db";
import { requireUser, getActiveMembership } from "@/lib/dal";
import { projectVisibilityWhere, boardVisibilityWhere } from "@/lib/authz";
import { dueMeta, dueToneClass } from "@/lib/due";
import { REVIEW_STATUS_LABEL, type ReviewStatus } from "@/lib/methodology";
import { SectionHeader } from "@/components/shared/page";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { ReviewInbox, type InboxReview } from "@/components/my-work/review-inbox";
import { artifactLink, DELIVERABLE_SELECT } from "@/components/my-work/artifact";

export const metadata = { title: "My Work · IDStudio" };

// Reviewer's actionable queue vs. the requester's open loops. Resolved reviews
// (approved / changes-requested) live on the Review History tab.
const REVIEWER_OPEN = ["requested", "in_review"] as const;
const REQUESTER_OPEN = ["requested", "in_review"] as const;

export default async function MyWorkPage() {
  const me = await requireUser();
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");
  const wsId = membership.workspaceId;

  const [projectVis, boardVis] = await Promise.all([projectVisibilityWhere(), boardVisibilityWhere()]);

  const [toReview, requested, cards, milestones] = await Promise.all([
    prisma.reviewCycle.findMany({
      where: {
        reviewerId: me.id,
        status: { in: [...REVIEWER_OPEN] },
        deliverable: { project: { workspaceId: wsId, ...projectVis } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true, round: true, status: true, dueDate: true, feedback: true,
        requestedBy: { select: { name: true, email: true } },
        deliverable: { select: DELIVERABLE_SELECT },
      },
    }),
    prisma.reviewCycle.findMany({
      where: {
        requestedById: me.id,
        reviewerId: { not: me.id },
        status: { in: [...REQUESTER_OPEN] },
        deliverable: { project: { workspaceId: wsId, ...projectVis } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true, status: true, dueDate: true,
        reviewer: { select: { name: true, email: true } },
        deliverable: { select: DELIVERABLE_SELECT },
      },
    }),
    prisma.card.findMany({
      where: { assignees: { some: { userId: me.id } }, column: { board: { workspaceId: wsId, ...boardVis } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      select: { id: true, title: true, dueDate: true, column: { select: { name: true, board: { select: { id: true, name: true } } } } },
    }),
    prisma.milestone.findMany({
      where: { completedAt: null, dueDate: { not: null }, project: { workspaceId: wsId, ...projectVis } },
      orderBy: { dueDate: "asc" },
      take: 8,
      select: { id: true, name: true, dueDate: true, project: { select: { id: true, name: true } } },
    }),
  ]);

  const inbox: InboxReview[] = toReview.map((r) => ({
    id: r.id,
    round: r.round,
    status: r.status,
    dueIso: r.dueDate ? r.dueDate.toISOString() : null,
    feedback: r.feedback,
    requestedBy: r.requestedBy?.name ?? r.requestedBy?.email ?? null,
    deliverableName: r.deliverable.name,
    projectName: r.deliverable.project.name,
    projectId: r.deliverable.project.id,
    link: artifactLink(r.deliverable),
  }));

  const totalOpen = inbox.length + requested.length + cards.length + milestones.length;

  if (totalOpen === 0) {
    return (
      <EmptyState
        className="mt-4"
        icon={ClipboardCheck}
        title="You're all caught up"
        description="No open reviews, assigned cards, or upcoming milestones right now."
      />
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {/* Awaiting my review — interactive */}
      <section>
        <SectionHeader>Awaiting my review · {inbox.length}</SectionHeader>
        {inbox.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing needs your review right now.</p>
        ) : (
          <ReviewInbox reviews={inbox} />
        )}
      </section>

      {/* I'm waiting on — reviews I requested */}
      <section>
        <SectionHeader>I&apos;m waiting on · {requested.length}</SectionHeader>
        {requested.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven&apos;t requested any open reviews.</p>
        ) : (
          <Card className="divide-y divide-border p-0">
            {requested.map((r) => {
              const link = artifactLink(r.deliverable);
              const due = dueMeta(r.dueDate);
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <Send className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <Link href={link.href} className="truncate font-medium hover:underline">
                      {r.deliverable.name}
                    </Link>
                    <div className="truncate text-sm text-muted-foreground">
                      {r.deliverable.project.name} · reviewer: {r.reviewer.name ?? r.reviewer.email}
                    </div>
                  </div>
                  <StatusBadge tone={r.status === "changes_requested" ? "warning" : "info"}>
                    {REVIEW_STATUS_LABEL[r.status as ReviewStatus] ?? r.status}
                  </StatusBadge>
                  {due && <span className={`text-xs ${dueToneClass[due.tone]}`}>{due.label}</span>}
                </div>
              );
            })}
          </Card>
        )}
      </section>

      {/* My action items — assigned cards */}
      <section>
        <SectionHeader>My action items · {cards.length}</SectionHeader>
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cards are assigned to you.</p>
        ) : (
          <Card className="divide-y divide-border p-0">
            {cards.map((c) => {
              const due = dueMeta(c.dueDate);
              return (
                <Link key={c.id} href={`/boards/${c.column.board.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-muted/50">
                  <Columns3 className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.title}</div>
                    <div className="truncate text-sm text-muted-foreground">
                      {c.column.board.name} · {c.column.name}
                    </div>
                  </div>
                  {due && <span className={`text-xs ${dueToneClass[due.tone]}`}>{due.label}</span>}
                </Link>
              );
            })}
          </Card>
        )}
      </section>

      {/* Upcoming milestones */}
      <section>
        <SectionHeader>Upcoming milestones · {milestones.length}</SectionHeader>
        {milestones.length === 0 ? (
          <p className="text-sm text-muted-foreground">No milestones coming due.</p>
        ) : (
          <Card className="divide-y divide-border p-0">
            {milestones.map((m) => {
              const due = dueMeta(m.dueDate);
              return (
                <Link key={m.id} href={`/projects/${m.project.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-muted/50">
                  <Flag className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{m.name}</div>
                    <div className="truncate text-sm text-muted-foreground">{m.project.name}</div>
                  </div>
                  {due && <span className={`text-xs ${dueToneClass[due.tone]}`}>{due.label}</span>}
                </Link>
              );
            })}
          </Card>
        )}
      </section>
    </div>
  );
}
