-- Remove the course-authoring module (Rise-style block editor + SCORM/xAPI
-- export). It was an in-app authoring tool, which is off-strategy: IDStudio sits
-- above authoring tools, it doesn't replace them. Tables are dropped children
-- first so foreign keys resolve without CASCADE. The alignment spine
-- (LearningObjective / AssessmentItem / Screen) is independent and untouched.

-- DropTable
DROP TABLE "Block";

-- DropTable
DROP TABLE "CourseGroup";

-- DropTable
DROP TABLE "Lesson";

-- DropTable
DROP TABLE "Section";

-- DropTable
DROP TABLE "Course";
