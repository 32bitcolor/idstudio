import Link from "next/link";
import { redirect } from "next/navigation";
import { MonitorPlay, Plus } from "lucide-react";

import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { courseVisibilityWhere } from "@/lib/authz";
import { createCourse } from "@/app/actions/courses";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Courses · IDStudio" };

export default async function CoursesPage() {
  const membership = await getActiveMembership();
  if (!membership) redirect("/login");

  const courses = await prisma.course.findMany({
    where: { workspaceId: membership.workspaceId, ...(await courseVisibilityWhere()) },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      _count: { select: { lessons: true } },
      deliverable: { select: { name: true } },
    },
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow={membership.workspace.name}
        title="Courses"
        description="Build responsive, block-based courses — ready to export to your LMS."
      />

      <form action={createCourse} className="mt-6 flex flex-wrap gap-2">
        <Input name="title" required maxLength={200} placeholder="New course title…" className="w-72" />
        <Button type="submit">
          <Plus className="size-4" /> Create course
        </Button>
      </form>

      {courses.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={MonitorPlay}
          title="No courses yet"
          description="Create a course to build lessons from content and interactive blocks — headings, text, statements, images, accordions, and knowledge checks."
        />
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <li key={c.id}>
              <Link href={`/courses/${c.id}`} className="group block">
                <Card className="gap-2 py-4 transition-colors group-hover:border-border-strong">
                  <div className="flex items-start justify-between gap-2 px-5">
                    <span className="min-w-0 truncate font-medium">{c.title}</span>
                    <StatusBadge tone={(c.status === "published" ? "success" : "neutral") as StatusTone}>
                      {c.status === "published" ? "Published" : "Draft"}
                    </StatusBadge>
                  </div>
                  <div className="px-5 text-sm text-muted-foreground">
                    {c._count.lessons} {c._count.lessons === 1 ? "lesson" : "lessons"}
                    {c.deliverable ? ` · ${c.deliverable.name}` : ""}
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
