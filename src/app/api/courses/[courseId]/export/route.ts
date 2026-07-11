import { getCurrentUser } from "@/lib/dal";
import { getCourseForUser } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { buildCoursePackage, EXPORT_LABELS, type ExportFormat } from "@/lib/course-export";

export async function GET(req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const access = await getCourseForUser(courseId);
  if (!access) return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  const format = url.searchParams.get("format") as ExportFormat | null;
  if (!format || !(format in EXPORT_LABELS)) {
    return new Response("Unknown format. Use scorm12, scorm2004, or xapi.", { status: 400 });
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      description: true,
      lessons: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          blocks: { orderBy: { position: "asc" }, select: { id: true, blockType: true, content: true } },
        },
      },
    },
  });
  if (!course) return new Response("Not found", { status: 404 });

  const { zip, filename } = buildCoursePackage(course, format);
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
