-- Review rounds (docs/REVIEW-LINKS.md, phase 1). Hand-written: Prisma would add
-- ReviewCycle.roundId as NOT NULL straight away, which fails on any database that
-- already has reviews. Instead: create the tables, add the column nullable, backfill
-- one round per existing review (keeping its round number, so history and every
-- existing query are unchanged), then enforce NOT NULL and the constraints.

-- 1. New tables
CREATE TABLE "ReviewRound" (
    "id" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "targetKind" TEXT NOT NULL DEFAULT 'none',
    "snapshot" JSONB,
    "dueDate" TIMESTAMP(3),
    "createdById" TEXT,
    "closedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "overriddenById" TEXT,
    "overriddenAt" TIMESTAMP(3),
    "overrideReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewRound_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewComment" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "parentId" TEXT,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "anchor" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedById" TEXT,
    "resolvedNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewComment_pkey" PRIMARY KEY ("id")
);

-- 2. New ReviewCycle columns, roundId nullable until backfilled
ALTER TABLE "ReviewCycle" ADD COLUMN "decidedAt" TIMESTAMP(3),
ADD COLUMN "roundId" TEXT;

-- 3. Backfill: one round per (deliverable, round number). Today `round` is minted per
--    deliverable, so each existing review is its own round; DISTINCT ON is a guard in
--    case two ever share a number (they'd fold into one round). Legacy rounds carry no
--    snapshot — what was reviewed then wasn't recorded — and the UI says so.
INSERT INTO "ReviewRound" ("id", "deliverableId", "number", "targetKind", "dueDate", "createdById", "createdAt", "outcome", "closedAt")
SELECT DISTINCT ON (rc."deliverableId", rc."round")
    'rr' || substr(md5(rc."id"), 1, 23),
    rc."deliverableId",
    rc."round",
    CASE WHEN EXISTS (SELECT 1 FROM "Storyboard" sb WHERE sb."deliverableId" = rc."deliverableId") THEN 'storyboard' ELSE 'none' END,
    rc."dueDate",
    rc."requestedById",
    rc."createdAt",
    CASE rc."status" WHEN 'approved' THEN 'passed' WHEN 'changes_requested' THEN 'changes_requested' ELSE NULL END,
    CASE WHEN rc."status" IN ('approved', 'changes_requested') THEN rc."updatedAt" ELSE NULL END
FROM "ReviewCycle" rc
ORDER BY rc."deliverableId", rc."round", rc."createdAt";

UPDATE "ReviewCycle" rc
SET "roundId" = rr."id"
FROM "ReviewRound" rr
WHERE rr."deliverableId" = rc."deliverableId" AND rr."number" = rc."round";

UPDATE "ReviewCycle"
SET "decidedAt" = "updatedAt"
WHERE "status" IN ('approved', 'changes_requested');

-- 4. Enforce
ALTER TABLE "ReviewCycle" ALTER COLUMN "roundId" SET NOT NULL;

CREATE UNIQUE INDEX "ReviewRound_deliverableId_number_key" ON "ReviewRound"("deliverableId", "number");
CREATE INDEX "ReviewComment_roundId_status_idx" ON "ReviewComment"("roundId", "status");
CREATE INDEX "ReviewComment_parentId_idx" ON "ReviewComment"("parentId");
CREATE UNIQUE INDEX "ReviewCycle_roundId_reviewerId_key" ON "ReviewCycle"("roundId", "reviewerId");

ALTER TABLE "ReviewCycle" ADD CONSTRAINT "ReviewCycle_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ReviewRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewRound" ADD CONSTRAINT "ReviewRound_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewRound" ADD CONSTRAINT "ReviewRound_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReviewRound" ADD CONSTRAINT "ReviewRound_overriddenById_fkey" FOREIGN KEY ("overriddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ReviewRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ReviewComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
