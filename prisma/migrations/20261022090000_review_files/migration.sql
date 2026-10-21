-- Review files (docs/REVIEW-LINKS.md, phase 3): a round can review an uploaded PDF or image.

CREATE TABLE "ReviewFile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReviewFile_storageKey_key" ON "ReviewFile"("storageKey");
CREATE INDEX "ReviewFile_deliverableId_idx" ON "ReviewFile"("deliverableId");

ALTER TABLE "ReviewFile" ADD CONSTRAINT "ReviewFile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewFile" ADD CONSTRAINT "ReviewFile_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewFile" ADD CONSTRAINT "ReviewFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReviewRound" ADD COLUMN "fileId" TEXT;
ALTER TABLE "ReviewRound" ADD CONSTRAINT "ReviewRound_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "ReviewFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
