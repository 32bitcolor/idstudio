-- Keys a card had on boards it was moved off, so old short links keep resolving.
CREATE TABLE "CardKeyAlias" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "keySeq" INTEGER NOT NULL,
    "cardId" TEXT NOT NULL,
    CONSTRAINT "CardKeyAlias_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CardKeyAlias_boardId_keySeq_key" ON "CardKeyAlias"("boardId", "keySeq");
CREATE INDEX "CardKeyAlias_cardId_idx" ON "CardKeyAlias"("cardId");
ALTER TABLE "CardKeyAlias" ADD CONSTRAINT "CardKeyAlias_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardKeyAlias" ADD CONSTRAINT "CardKeyAlias_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
