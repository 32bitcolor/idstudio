import Link from "next/link";
import { redirect } from "next/navigation";
import { Shapes, Plus } from "lucide-react";

import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { whiteboardVisibilityWhere } from "@/lib/authz";
import { createWhiteboard } from "@/app/actions/whiteboards";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Whiteboards · IDStudio" };

export default async function WhiteboardsPage() {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");

  const whiteboards = await prisma.whiteboard.findMany({
    where: { workspaceId: membership.workspaceId, ...(await whiteboardVisibilityWhere()) },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true, storyboard: { select: { id: true, title: true } } },
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow={membership.workspace.name}
        title="Whiteboards"
        description="Freeform canvases for sketching workflows, wireframes, and ideas."
      />

      <form action={createWhiteboard} className="mt-6 flex flex-wrap gap-2">
        <Input name="title" required maxLength={180} placeholder="New whiteboard title…" className="w-72" />
        <Button type="submit">
          <Plus className="size-4" /> Create whiteboard
        </Button>
      </form>

      {whiteboards.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={Shapes}
          title="No whiteboards yet"
          description="Create a whiteboard to sketch a workflow, wireframe a screen, or map out ideas — solo or with your team."
        />
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {whiteboards.map((w) => (
            <li key={w.id}>
              <Link href={`/whiteboards/${w.id}`} className="group block">
                <Card className="gap-1 py-4 transition-colors group-hover:border-border-strong">
                  <div className="truncate px-5 font-medium">{w.title}</div>
                  <div className="truncate px-5 text-sm text-muted-foreground">
                    {w.storyboard ? `Linked to ${w.storyboard.title}` : "Whiteboard"}
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
