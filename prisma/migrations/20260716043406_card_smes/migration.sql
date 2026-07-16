-- Assignable SMEs (subject-matter experts) on cards and subtasks — a workspace
-- member designated as the SME for a card, distinct from its assignees.

-- CreateTable
CREATE TABLE "CardSme" (
    "cardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CardSme_pkey" PRIMARY KEY ("cardId","userId")
);

-- CreateIndex
CREATE INDEX "CardSme_userId_idx" ON "CardSme"("userId");

-- AddForeignKey
ALTER TABLE "CardSme" ADD CONSTRAINT "CardSme_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardSme" ADD CONSTRAINT "CardSme_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
