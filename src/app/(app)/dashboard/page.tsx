import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FolderKanban,
  Columns3,
  Film,
  ClipboardCheck,
  CalendarClock,
  ArrowRight,
  Plus,
} from "lucide-react";

import { requireUser, getActiveMembership } from "@/lib/dal";
import { boardVisibilityWhere, storyboardVisibilityWhere, projectVisibilityWhere } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { Role } from "@/generated/prisma/client";
import { NAV_MODULES } from "@/lib/modules";
import { PageContainer, PageHeader, SectionHeader } from "@/components/shared/page";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Dashboard · IDStudio" };

const PROJECT_STATUS_LABEL: Record<string, string> = {
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
};

function projectTone(status: string): StatusTone {
  if (status === "completed") return "success";
  if (status === "on_hold") return "warning";
  return "info";
}

function formatDue(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function DashboardPage() {
  const user = await requireUser();
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");

  const isAdmin = membership.role === Role.ADMIN;
  const wsId = membership.workspaceId;

  // Respect group-based access: the dashboard only counts/lists resources the
  // current user is allowed to see.
  const [projectVis, boardVis, storyboardVis] = await Promise.all([
    projectVisibilityWhere(),
    boardVisibilityWhere(),
    storyboardVisibilityWhere(),
  ]);

  const [projects, boardCount, storyboardCount, milestones, myReviews] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId: wsId, ...projectVis },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        methodology: true,
        status: true,
        phases: { select: { status: true } },
      },
    }),
    prisma.board.count({ where: { workspaceId: wsId, ...boardVis } }),
    prisma.storyboard.count({ where: { workspaceId: wsId, ...storyboardVis } }),
    prisma.milestone.findMany({
      where: { project: { workspaceId: wsId, ...projectVis }, completedAt: null, dueDate: { not: null } },
      orderBy: { dueDate: "asc" },
      take: 5,
      select: { id: true, name: true, dueDate: true, project: { select: { id: true, name: true } } },
    }),
    prisma.reviewCycle.findMany({
      where: {
        reviewerId: user.id,
        status: { in: ["requested", "in_review"] },
        deliverable: { project: { workspaceId: wsId } },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        deliverable: { select: { name: true, project: { select: { id: true, name: true } } } },
      },
    }),
  ]);

  const activeProjects = projects.filter((p) => p.status === "active");

  const stats = [
    { label: "Active projects", value: activeProjects.length, icon: FolderKanban, href: "/projects" },
    { label: "Boards", value: boardCount, icon: Columns3, href: "/boards" },
    { label: "Storyboards", value: storyboardCount, icon: Film, href: "/storyboards" },
    { label: "Awaiting your review", value: myReviews.length, icon: ClipboardCheck, href: "/my-work" },
  ];

  return (
    <PageContainer>
      <PageHeader
        eyebrow={membership.workspace.name}
        title={`Welcome back, ${user.name ?? user.email.split("@")[0]}`}
        description="Here's what's happening across your workspace."
        actions={<StatusBadge tone={isAdmin ? "info" : "neutral"}>{membership.role}</StatusBadge>}
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group">
            <Card className="gap-0 py-4 transition-colors group-hover:border-border-strong">
              <div className="flex items-center justify-between px-5">
                <span className="text-sm text-muted-foreground">{s.label}</span>
                <s.icon className="size-4 text-muted-foreground" />
              </div>
              <div className="mt-2 px-5 text-2xl font-semibold tabular-nums">{s.value}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionHeader
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/projects">
                  All projects <ArrowRight className="size-4" />
                </Link>
              </Button>
            }
          >
            Active projects
          </SectionHeader>
          {activeProjects.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="No active projects"
              description="Spin up an ADDIE or SAM project to plan phases, deliverables, and review cycles."
              action={
                <Button asChild size="sm">
                  <Link href="/projects">
                    <Plus className="size-4" /> New project
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              {activeProjects.slice(0, 5).map((p) => {
                const total = p.phases.length;
                const done = p.phases.filter((ph) => ph.status === "done").length;
                const pct = total ? Math.round((done / total) * 100) : 0;
                return (
                  <Link key={p.id} href={`/projects/${p.id}`} className="group">
                    <Card className="gap-3 py-4 transition-colors group-hover:border-border-strong">
                      <div className="flex items-center justify-between gap-3 px-5">
                        <span className="truncate font-medium">{p.name}</span>
                        <div className="flex shrink-0 items-center gap-2">
                          <StatusBadge tone="neutral">{p.methodology}</StatusBadge>
                          <StatusBadge tone={projectTone(p.status)}>
                            {PROJECT_STATUS_LABEL[p.status] ?? p.status}
                          </StatusBadge>
                        </div>
                      </div>
                      <div className="px-5">
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {done}/{total} phases done
                          </span>
                          <span className="tabular-nums">{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-8">
          <div>
            <SectionHeader
              action={
                <Link href="/my-work" className="text-xs text-muted-foreground hover:underline">
                  View all →
                </Link>
              }
            >
              Awaiting your review
            </SectionHeader>
            {myReviews.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                You&rsquo;re all caught up.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {myReviews.map((r) => (
                  <Link key={r.id} href="/my-work" className="group">
                    <Card className="gap-1 py-3 transition-colors group-hover:border-border-strong">
                      <div className="truncate px-4 text-sm font-medium">{r.deliverable.name}</div>
                      <div className="truncate px-4 text-xs text-muted-foreground">
                        {r.deliverable.project.name}
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <SectionHeader>Upcoming milestones</SectionHeader>
            {milestones.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No upcoming milestones.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {milestones.map((m) => (
                  <Link key={m.id} href={`/projects/${m.project.id}`} className="group">
                    <Card className="gap-1 py-3 transition-colors group-hover:border-border-strong">
                      <div className="flex items-center justify-between gap-2 px-4">
                        <span className="truncate text-sm font-medium">{m.name}</span>
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          <CalendarClock className="size-3" />
                          {m.dueDate ? formatDue(m.dueDate) : ""}
                        </span>
                      </div>
                      <div className="truncate px-4 text-xs text-muted-foreground">{m.project.name}</div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="mt-10">
        <SectionHeader>Jump back in</SectionHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          {NAV_MODULES.filter((m) => m.href).map((m) => (
            <Link key={m.key} href={m.href!} className="group">
              <Card className="gap-2 py-4 transition-colors group-hover:border-border-strong">
                <div className="flex items-center gap-2 px-5">
                  <m.icon className="size-4 text-muted-foreground" />
                  <span className="font-medium">{m.name}</span>
                </div>
                <p className="px-5 text-sm text-muted-foreground">{m.tagline}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {isAdmin && (
        <section className="mt-10">
          <Card className="gap-1 py-4">
            <div className="px-5 text-sm font-medium">Admin tools</div>
            <p className="px-5 text-sm text-muted-foreground">
              Only workspace admins see this. Member management and workspace settings will live here.
            </p>
          </Card>
        </section>
      )}
    </PageContainer>
  );
}
