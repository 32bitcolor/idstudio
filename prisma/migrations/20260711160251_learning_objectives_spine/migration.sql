-- CreateTable
CREATE TABLE "LearningObjective" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "bloomLevel" TEXT NOT NULL DEFAULT 'understand',
    "position" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenObjective" (
    "screenId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,

    CONSTRAINT "ScreenObjective_pkey" PRIMARY KEY ("screenId","objectiveId")
);

-- CreateTable
CREATE TABLE "AssessmentItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "itemType" TEXT NOT NULL DEFAULT 'multiple_choice',
    "position" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentItemObjective" (
    "itemId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,

    CONSTRAINT "AssessmentItemObjective_pkey" PRIMARY KEY ("itemId","objectiveId")
);

-- CreateIndex
CREATE INDEX "LearningObjective_projectId_position_idx" ON "LearningObjective"("projectId", "position");

-- CreateIndex
CREATE INDEX "ScreenObjective_objectiveId_idx" ON "ScreenObjective"("objectiveId");

-- CreateIndex
CREATE INDEX "AssessmentItem_projectId_position_idx" ON "AssessmentItem"("projectId", "position");

-- CreateIndex
CREATE INDEX "AssessmentItemObjective_objectiveId_idx" ON "AssessmentItemObjective"("objectiveId");

-- AddForeignKey
ALTER TABLE "LearningObjective" ADD CONSTRAINT "LearningObjective_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenObjective" ADD CONSTRAINT "ScreenObjective_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenObjective" ADD CONSTRAINT "ScreenObjective_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "LearningObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentItem" ADD CONSTRAINT "AssessmentItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentItemObjective" ADD CONSTRAINT "AssessmentItemObjective_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AssessmentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentItemObjective" ADD CONSTRAINT "AssessmentItemObjective_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "LearningObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
