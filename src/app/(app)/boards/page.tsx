import Link from "next/link";
import { redirect } from "next/navigation";
import { Columns3, Plus } from "lucide-react";

import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { boardVisibilityWhere } from "@/lib/authz";
import { createBoard } from "@/app/actions/boards";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Boards · IDStudio" };

export default async function BoardsPage() {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");

  const boards = await prisma.board.findMany({
    where: { workspaceId: membership.workspaceId, ...(await boardVisibilityWhere()) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      project: { select: { id: true, name: true } },
      _count: { select: { columns: true } },
    },
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow={membership.workspace.name}
        title="Boards"
        description="Kanban boards for your production pipeline."
      />

      <form action={createBoard} className="mt-6 flex flex-wrap gap-2">
        <Input name="name" required maxLength={120} placeholder="New board name…" className="w-72" />
        <Input
          name="cardKeyPrefix"
          maxLength={8}
          placeholder="Card prefix (optional, e.g. WP)"
          className="w-56 uppercase placeholder:normal-case"
        />
        <Button type="submit">
          <Plus className="size-4" /> Create board
        </Button>
      </form>

      {boards.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={Columns3}
          title="No boards yet"
          description="Create a board to move cards across columns — ideal for a course build or a content pipeline."
        />
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => (
            <li key={b.id}>
              <Link href={`/boards/${b.id}`} className="group block">
                <Card className="gap-1 py-4 transition-colors group-hover:border-border-strong">
                  <div className="truncate px-5 font-medium">{b.name}</div>
                  <div className="flex items-center gap-2 px-5 text-sm text-muted-foreground">
                    <span>
                      {b._count.columns} {b._count.columns === 1 ? "column" : "columns"}
                    </span>
                    {b.project && (
                      <span className="truncate rounded bg-muted px-1.5 py-0.5 text-xs" title={`Project: ${b.project.name}`}>
                        {b.project.name}
                      </span>
                    )}
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
