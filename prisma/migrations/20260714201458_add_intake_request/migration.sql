-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "intakeEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "IntakeRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "requestedById" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "targetAudience" TEXT,
    "targetDate" TIMESTAMP(3),
    "impactScore" INTEGER,
    "effortScore" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "assignedToId" TEXT,
    "rejectionReason" TEXT,
    "convertedProjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntakeRequest_convertedProjectId_key" ON "IntakeRequest"("convertedProjectId");

-- CreateIndex
CREATE INDEX "IntakeRequest_workspaceId_status_idx" ON "IntakeRequest"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeRequest_workspaceId_number_key" ON "IntakeRequest"("workspaceId", "number");

-- AddForeignKey
ALTER TABLE "IntakeRequest" ADD CONSTRAINT "IntakeRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeRequest" ADD CONSTRAINT "IntakeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeRequest" ADD CONSTRAINT "IntakeRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeRequest" ADD CONSTRAINT "IntakeRequest_convertedProjectId_fkey" FOREIGN KEY ("convertedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
