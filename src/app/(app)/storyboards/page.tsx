import Link from "next/link";
import { redirect } from "next/navigation";
import { Film, Plus } from "lucide-react";

import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { storyboardVisibilityWhere } from "@/lib/authz";
import { createStoryboard } from "@/app/actions/storyboards";
import { STORYBOARD_STATUS_LABEL, type StoryboardStatus } from "@/lib/storyboard";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Storyboards · IDStudio" };

function storyboardTone(status: string): StatusTone {
  if (status === "approved") return "success";
  if (status === "in_review") return "info";
  return "neutral";
}

export default async function StoryboardsPage() {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");

  const storyboards = await prisma.storyboard.findMany({
    where: { workspaceId: membership.workspaceId, ...(await storyboardVisibilityWhere()) },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      _count: { select: { screens: true } },
      deliverable: { select: { id: true, name: true, projectId: true } },
    },
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow={membership.workspace.name}
        title="Storyboards"
        description="Screen-by-screen course design, ready for SME review."
      />

      <form action={createStoryboard} className="mt-6 flex flex-wrap gap-2">
        <Input name="title" required maxLength={180} placeholder="New storyboard title…" className="w-72" />
        <Button type="submit">
          <Plus className="size-4" /> Create storyboard
        </Button>
      </form>

      {storyboards.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={Film}
          title="No storyboards yet"
          description="Create a storyboard to lay out screens, narration, and interaction notes for a course."
        />
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {storyboards.map((sb) => (
            <li key={sb.id}>
              <Link href={`/storyboards/${sb.id}`} className="group block">
                <Card className="gap-2 py-4 transition-colors group-hover:border-border-strong">
                  <div className="flex items-start justify-between gap-2 px-5">
                    <span className="min-w-0 truncate font-medium">{sb.title}</span>
                    <StatusBadge tone={storyboardTone(sb.status)}>
                      {STORYBOARD_STATUS_LABEL[sb.status as StoryboardStatus] ?? sb.status}
                    </StatusBadge>
                  </div>
                  <div className="px-5 text-sm text-muted-foreground">
                    {sb._count.screens} {sb._count.screens === 1 ? "screen" : "screens"}
                    {sb.deliverable ? ` · ${sb.deliverable.name}` : ""}
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
