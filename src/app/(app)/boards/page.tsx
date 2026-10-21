import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, Columns3, FolderKanban } from "lucide-react";

import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { boardVisibilityWhere } from "@/lib/authz";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { CreateButton } from "@/components/app-shell/quick-create";
import { EmptyState } from "@/components/shared/empty-state";
import { AvatarStack, type WorkMember } from "@/components/shared/work-item";

export const metadata = { title: "Boards · IDStudio" };

type Tally = { todo: number; active: number; done: number; overdue: number; updatedAt: Date; people: Map<string, WorkMember> };

/** Per-board counts by status category, overdue open cards, who has open work, and the
 *  latest change. Subtasks are left out: the tile is about the board's cards. */
async function tallyCards(boardIds: string[], updated: Map<string, Date>) {
  const cards = await prisma.card.findMany({
    where: { column: { boardId: { in: boardIds } } },
    select: {
      dueDate: true,
      updatedAt: true,
      status: { select: { category: true } },
      column: { select: { boardId: true } },
      assignees: { select: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  const now = Date.now();
  const out = new Map<string, Tally>(
    boardIds.map((id) => [id, { todo: 0, active: 0, done: 0, overdue: 0, updatedAt: updated.get(id)!, people: new Map() }]),
  );
  for (const c of cards) {
    const t = out.get(c.column!.boardId)!;
    const cat = (c.status?.category ?? "todo") as "todo" | "active" | "done";
    t[cat in t ? cat : "todo"]++;
    if (c.updatedAt > t.updatedAt) t.updatedAt = c.updatedAt;
    if (cat !== "done") {
      if (c.dueDate && c.dueDate.getTime() < now - 86_400_000) t.overdue++;
      for (const a of c.assignees) t.people.set(a.user.id, a.user);
    }
  }
  return out;
}

function ago(d: Date): string {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function BoardsPage() {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");

  const boards = await prisma.board.findMany({
    where: { workspaceId: membership.workspaceId, ...(await boardVisibilityWhere()) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      cardKeyPrefix: true,
      updatedAt: true,
      project: { select: { id: true, name: true } },
    },
  });
  const tallies = await tallyCards(
    boards.map((b) => b.id),
    new Map(boards.map((b) => [b.id, b.updatedAt])),
  );

  return (
    <PageContainer>
      <PageHeader
        title="Boards"
        description="Kanban boards for your production pipeline."
        actions={<CreateButton kind="board" />}
      />

      {boards.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={Columns3}
          title="No boards yet"
          description="Create a board to move cards across columns — ideal for a course build or a content pipeline."
        />
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
          {boards.map((b) => (
            <li key={b.id}>
              <BoardTile board={b} tally={tallies.get(b.id)!} />
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}

function BoardTile({
  board,
  tally,
}: {
  board: { id: string; name: string; cardKeyPrefix: string | null; project: { id: string; name: string } | null };
  tally: Tally;
}) {
  const total = tally.todo + tally.active + tally.done;
  const open = total - tally.done;
  const pct = (n: number) => `${(n / total) * 100}%`;
  const people = [...tally.people.values()];
  return (
    <Link
      href={`/boards/${board.id}`}
      className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm outline-none transition-colors hover:border-border-strong focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <div className="flex items-start gap-2">
        <h2 className="line-clamp-2 min-w-0 flex-1 font-semibold leading-snug group-hover:underline group-hover:underline-offset-2">{board.name}</h2>
        {board.cardKeyPrefix && (
          <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground" title="Card key prefix">
            {board.cardKeyPrefix}
          </span>
        )}
      </div>

      <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
        {board.project ? (
          <>
            <FolderKanban className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate" title={`Project: ${board.project.name}`}>
              {board.project.name}
            </span>
          </>
        ) : (
          <>
            <Columns3 className="size-3.5 shrink-0" aria-hidden="true" />
            <span>Standalone board</span>
          </>
        )}
      </p>

      <div className="mt-auto flex flex-col gap-1.5">
        {total > 0 ? (
          <>
            <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <span className="bg-success" style={{ width: pct(tally.done) }} />
              <span className="bg-info" style={{ width: pct(tally.active) }} />
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{open}</span> open
              {tally.active > 0 && <> · {tally.active} in progress</>} · {tally.done} done
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No cards yet</p>
        )}
      </div>

      <div className="flex min-h-6 items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        {tally.overdue > 0 && (
          <span className="inline-flex items-center gap-1 font-medium text-destructive-ink">
            <AlertCircle className="size-3.5" aria-hidden="true" />
            {tally.overdue} overdue
          </span>
        )}
        <AvatarStack assignees={people} />
        {people.length > 3 && <span>+{people.length - 3}</span>}
        <span className="ml-auto shrink-0">Updated {ago(tally.updatedAt)}</span>
      </div>
    </Link>
  );
}
