import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban, Plus } from "lucide-react";

import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { createProject } from "@/app/actions/projects";
import { PROJECT_STATUS_LABEL, type ProjectStatus } from "@/lib/methodology";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export const metadata = { title: "Projects · IDStudio" };

function projectTone(status: string): StatusTone {
  if (status === "completed") return "success";
  if (status === "on_hold") return "warning";
  return "info";
}

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
    <PageContainer>
      <PageHeader
        eyebrow={membership.workspace.name}
        title="Projects"
        description="ADDIE/SAM projects — phases, deliverables, SME reviews, and time."
      />

      <form action={createProject} className="mt-6 flex flex-wrap items-center gap-2">
        <Input name="name" required maxLength={140} placeholder="New project name…" className="w-64" />
        <div className="w-44">
          <Select name="methodology" defaultValue="ADDIE" aria-label="Methodology">
            <option value="ADDIE">ADDIE</option>
            <option value="SAM">SAM</option>
            <option value="CUSTOM">Custom (start empty)</option>
          </Select>
        </div>
        <Button type="submit">
          <Plus className="size-4" /> Create project
        </Button>
      </form>

      {projects.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={FolderKanban}
          title="No projects yet"
          description="Start an ADDIE or SAM project to plan phases, link deliverables, and run SME review cycles."
        />
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const total = p.phases.length;
            const done = p.phases.filter((ph) => ph.status === "done").length;
            const pct = total ? Math.round((done / total) * 100) : 0;
            return (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="group block">
                  <Card className="gap-3 py-4 transition-colors group-hover:border-border-strong">
                    <div className="flex items-center justify-between gap-2 px-5">
                      <span className="truncate font-medium">{p.name}</span>
                      <StatusBadge tone="neutral">{p.methodology}</StatusBadge>
                    </div>
                    <div className="px-5">
                      <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                        <StatusBadge tone={projectTone(p.status)}>
                          {PROJECT_STATUS_LABEL[p.status as ProjectStatus] ?? p.status}
                        </StatusBadge>
                        <span className="tabular-nums">
                          {done}/{total} phases
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
