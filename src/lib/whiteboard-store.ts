import "server-only";
import { prisma } from "@/lib/db";
import { mergeScenes, parseScene, serializeScene, type Scene } from "@/lib/whiteboard-scene";

// Every write to a whiteboard's scene goes through commitScene: read the stored scene and
// its sceneVersion, change it, and write it back only if nobody else wrote in between
// (otherwise read again and redo). Browser saves and MCP edits can then both land on an
// open whiteboard without either overwriting the other (lib/whiteboard-scene.ts merges).

// Excalidraw scenes (with embedded image files) can get large; cap generously.
export const MAX_SCENE = 8_000_000;

export class SceneTooLarge extends Error {}

export async function loadScene(id: string): Promise<{ scene: Scene; version: number } | null> {
  const wb = await prisma.whiteboard.findUnique({ where: { id }, select: { scene: true, sceneVersion: true } });
  return wb ? { scene: parseScene(wb.scene), version: wb.sceneVersion } : null;
}

export async function commitScene(
  id: string,
  change: (current: Scene) => Scene,
): Promise<{ scene: Scene; version: number; previousVersion: number }> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await loadScene(id);
    if (!current) throw new Error("Whiteboard not found.");
    const next = change(current.scene);
    const raw = serializeScene(next);
    if (raw.length > MAX_SCENE) throw new SceneTooLarge();
    const res = await prisma.whiteboard.updateMany({
      where: { id, sceneVersion: current.version },
      data: { scene: raw, sceneVersion: { increment: 1 } },
    });
    if (res.count === 1) return { scene: next, version: current.version + 1, previousVersion: current.version };
  }
  throw new Error("The whiteboard is busy; try again.");
}

/** Merge a browser's copy into the stored scene. */
export function saveSceneFrom(id: string, incoming: Scene) {
  return commitScene(id, (current) => mergeScenes(current, incoming));
}
