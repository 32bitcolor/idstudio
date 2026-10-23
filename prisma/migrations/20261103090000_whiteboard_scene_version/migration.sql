-- Every scene write bumps this; writes only land if it is unchanged since they read (lib/whiteboard-store.ts).
ALTER TABLE "Whiteboard" ADD COLUMN "sceneVersion" INTEGER NOT NULL DEFAULT 0;
