-- Requester status pages and the intake conversation (lib/intake-status.ts).
CREATE TABLE "IntakeMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'reply',
    "fromRequester" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntakeMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "IntakeMessage_requestId_createdAt_idx" ON "IntakeMessage"("requestId", "createdAt");
ALTER TABLE "IntakeMessage" ADD CONSTRAINT "IntakeMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "IntakeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntakeMessage" ADD CONSTRAINT "IntakeMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Questions asked with "Ask for info" become the first replies in the conversation.
INSERT INTO "IntakeMessage" ("id", "requestId", "kind", "body", "createdAt")
SELECT 'mig' || md5(random()::text || "id"), "id", 'reply', "infoQuestion", COALESCE("infoRequestedAt", "updatedAt")
FROM "IntakeRequest" WHERE "infoQuestion" IS NOT NULL;

ALTER TABLE "IntakeRequest" DROP COLUMN "infoQuestion", DROP COLUMN "infoRequestedAt";

-- Every request gets a status-page nonce (new rows get one from Prisma).
ALTER TABLE "IntakeRequest" ADD COLUMN "statusNonce" TEXT;
UPDATE "IntakeRequest" SET "statusNonce" = md5(random()::text || "id" || clock_timestamp()::text);
ALTER TABLE "IntakeRequest" ALTER COLUMN "statusNonce" SET NOT NULL;
