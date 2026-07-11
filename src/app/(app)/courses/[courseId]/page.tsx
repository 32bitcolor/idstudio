import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCourseForUser } from "@/lib/authz";
import { CourseView } from "@/components/course/course-view";

export const metadata = { title: "Course · IDStudio" };

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;

  const access = await getCourseForUser(courseId);
  if (!access) notFound();

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      deliverable: {
        select: { id: true, name: true, projectId: true, project: { select: { name: true } } },
      },
      lessons: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          position: true,
          blocks: {
            orderBy: { position: "asc" },
            select: { id: true, blockType: true, content: true, position: true },
          },
        },
      },
    },
  });
  if (!course) notFound();

  // Objectives (via the linked deliverable's project) — knowledge-check blocks
  // can tag which they assess.
  const projectId = course.deliverable?.projectId;
  const projectObjectives = projectId
    ? await prisma.learningObjective.findMany({
        where: { projectId },
        orderBy: { position: "asc" },
        select: { id: true, text: true },
      })
    : [];

  return (
    <CourseView
      course={{
        id: course.id,
        title: course.title,
        description: course.description,
        status: course.status,
        deliverable: course.deliverable
          ? {
              id: course.deliverable.id,
              name: course.deliverable.name,
              projectId: course.deliverable.projectId,
              projectName: course.deliverable.project.name,
            }
          : null,
      }}
      initialLessons={course.lessons}
      projectObjectives={projectObjectives}
    />
  );
}
