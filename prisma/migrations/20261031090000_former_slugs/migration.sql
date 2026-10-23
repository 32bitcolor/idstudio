-- Old intake-link slugs, so /request/<old> forwards after an admin changes the link.
ALTER TABLE "Workspace" ADD COLUMN "formerSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[];
