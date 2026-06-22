import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { createBoard } from "@/app/actions/boards";

export const metadata = { title: "Boards · IDStudio" };

export default async function BoardsPage() {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");

  const boards = await prisma.board.findMany({
    where: { workspaceId: membership.workspaceId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, _count: { select: { columns: true } } },
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-foreground/60 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Boards</h1>
          <p className="text-sm text-foreground/60">{membership.workspace.name}</p>
        </div>
      </div>

      <form action={createBoard} className="mt-6 flex gap-2">
        <input
          name="name"
          required
          maxLength={120}
          placeholder="New board name…"
          className="w-72 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/60"
        />
        <button className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background">
          Create board
        </button>
      </form>

      {boards.length === 0 ? (
        <p className="mt-10 text-sm text-foreground/50">No boards yet. Create your first one above.</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => (
            <li key={b.id}>
              <Link
                href={`/boards/${b.id}`}
                className="block rounded-xl border border-black/10 dark:border-white/15 p-4 hover:border-foreground/40"
              >
                <h2 className="font-medium">{b.name}</h2>
                <p className="mt-1 text-sm text-foreground/50">{b._count.columns} columns</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
