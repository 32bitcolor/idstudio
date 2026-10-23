-- Intake basics (lib/intake.ts): decisions recorded, "Ask for info", no "approved" status.
ALTER TABLE "IntakeRequest" ADD COLUMN "decidedById" TEXT,
ADD COLUMN "decidedAt" TIMESTAMP(3),
ADD COLUMN "infoQuestion" TEXT,
ADD COLUMN "infoRequestedAt" TIMESTAMP(3);

ALTER TABLE "IntakeRequest" ADD CONSTRAINT "IntakeRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- "approved" was never set by the app; fold any stray rows into what they mean.
UPDATE "IntakeRequest" SET "status" = CASE WHEN "convertedProjectId" IS NOT NULL THEN 'converted' ELSE 'triaging' END
WHERE "status" = 'approved';

-- Decisions made before this migration: the time is the last update, the person unknown.
UPDATE "IntakeRequest" SET "decidedAt" = "updatedAt" WHERE "status" IN ('converted', 'rejected');
