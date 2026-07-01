import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { createStoryboard } from "@/app/actions/storyboards";
import { STORYBOARD_STATUS_LABEL, type StoryboardStatus } from "@/lib/storyboard";

export const metadata = { title: "Storyboards · IDStudio" };

function statusClass(s: string) {
  if (s === "approved") return "bg-green-500/15 text-green-600";
  if (s === "in_review") return "bg-blue-500/15 text-blue-600";
  return "bg-muted text-foreground/60";
}

export default async function StoryboardsPage() {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");

  const storyboards = await prisma.storyboard.findMany({
    where: { workspaceId: membership.workspaceId },
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
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Storyboards</h1>
        <p className="text-sm text-foreground/60">{membership.workspace.name}</p>
      </div>

      <form action={createStoryboard} className="mt-6 flex gap-2">
        <input
          name="title"
          required
          maxLength={180}
          placeholder="New storyboard title…"
          className="w-72 rounded-md border border-border-strong bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/60"
        />
        <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
          Create storyboard
        </button>
      </form>

      {storyboards.length === 0 ? (
        <p className="mt-10 text-sm text-foreground/50">No storyboards yet. Create your first one above.</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {storyboards.map((sb) => (
            <li key={sb.id}>
              <Link
                href={`/storyboards/${sb.id}`}
                className="block rounded-xl border border-border p-4 hover:border-foreground/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="min-w-0 font-medium">{sb.title}</h2>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(sb.status)}`}>
                    {STORYBOARD_STATUS_LABEL[sb.status as StoryboardStatus] ?? sb.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-foreground/50">
                  {sb._count.screens} {sb._count.screens === 1 ? "screen" : "screens"}
                  {sb.deliverable ? ` · ${sb.deliverable.name}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
