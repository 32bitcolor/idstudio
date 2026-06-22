import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { createProject } from "@/app/actions/projects";
import { PROJECT_STATUS_LABEL, type ProjectStatus } from "@/lib/methodology";

export const metadata = { title: "Projects · IDStudio" };

const inputClass =
  "rounded-md border border-border-strong bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/60";

export default async function ProjectsPage() {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");

  const projects = await prisma.project.findMany({
    where: { workspaceId: membership.workspaceId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      methodology: true,
      status: true,
      phases: { select: { status: true } },
    },
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div>
        <Link href="/dashboard" className="text-sm text-foreground/60 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="text-sm text-foreground/60">{membership.workspace.name}</p>
      </div>

      <form action={createProject} className="mt-6 flex flex-wrap gap-2">
        <input name="name" required maxLength={140} placeholder="New project name…" className={`w-72 ${inputClass}`} />
        <select name="methodology" defaultValue="ADDIE" className={inputClass}>
          <option value="ADDIE">ADDIE</option>
          <option value="SAM">SAM</option>
          <option value="CUSTOM">Custom (start empty)</option>
        </select>
        <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
          Create project
        </button>
      </form>

      {projects.length === 0 ? (
        <p className="mt-10 text-sm text-foreground/50">No projects yet. Create your first one above.</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const total = p.phases.length;
            const done = p.phases.filter((ph) => ph.status === "done").length;
            return (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="block rounded-xl border border-border p-4 hover:border-foreground/40">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="truncate font-medium">{p.name}</h2>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground/70">{p.methodology}</span>
                  </div>
                  <p className="mt-2 text-sm text-foreground/60">
                    {PROJECT_STATUS_LABEL[p.status as ProjectStatus] ?? p.status}
                    {total > 0 && <> · {done}/{total} phases done</>}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
