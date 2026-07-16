import { positionsAfter } from "@/lib/ordering";

// Canonical per-workspace status vocabulary (Phase 0 of the Projects↔Boards
// redesign — see docs/PROJECTS-BOARDS-REDESIGN.md). A board's columns each map
// to one of these; cross-project views group cards by them. Keep in sync with
// the seed in the canonical_status_and_board_project migration.
export const DEFAULT_WORKSPACE_STATUSES = [
  { name: "Backlog", category: "todo" },
  { name: "To do", category: "todo" },
  { name: "In progress", category: "active" },
  { name: "In review", category: "active" },
  { name: "Done", category: "done" },
] as const;

/** New columns/cards whose name doesn't match a status fall back to this. */
export const FALLBACK_STATUS_NAME = "In progress";

/** Rows to seed the default status set for a workspace. Positions are the
 *  fractional-index keys the app would generate (a0, a1, …) so later reordering
 *  between them works. */
export function workspaceStatusSeedData(workspaceId: string) {
  const positions = positionsAfter(null, DEFAULT_WORKSPACE_STATUSES.length);
  return DEFAULT_WORKSPACE_STATUSES.map((s, i) => ({
    workspaceId,
    name: s.name,
    category: s.category,
    position: positions[i],
  }));
}

/** The canonical status a column/card should take for a given column name —
 *  exact (case-insensitive) match, else the fallback status, else the first. */
export function pickStatusIdForName(
  statuses: { id: string; name: string }[],
  columnName: string,
): string | null {
  const lower = columnName.trim().toLowerCase();
  const match = statuses.find((s) => s.name.toLowerCase() === lower);
  if (match) return match.id;
  const fallback = statuses.find((s) => s.name === FALLBACK_STATUS_NAME);
  return fallback?.id ?? statuses[0]?.id ?? null;
}
