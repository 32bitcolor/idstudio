# Projects ↔ Boards redesign — item-first model + team sprint board

**Status:** Phases 0–4 shipped. Phase 5 half-done — workspace-level labels shipped
(2026-08-12); saved filter views still outstanding.
**Owner:** @32bitcolor

## Why

Today Board and Project are **sibling** objects — two top-level nav modules, two data
roots, only loosely tied (a `Deliverable` can link to a single card). That's the awkward
middle: users feel "why is there a Board over here and a Project over there?"

IDStudio is a **project-first** product (intake → project → the team executes the work),
so a board should be *how a project's work is executed*, not a peer object. Concretely we
want:

- **Projects drive Boards** — spin up a project, then create its board(s).
- A **standalone "quick board" escape hatch** for backlog / misc-request work not tied to a
  project.
- A **cross-project team sprint board** that filters by assignee, sprint, status, project
  (and later label).

A cross-project sprint board is *impossible* in the current board-first model (a card belongs
to one board's column, and there's no card→project link). It's trivial in an **item-first**
model, which is what every comparable tool (Jira, Asana, Linear, Monday) actually does: the
work item is the atom, the project is the goal-oriented grouping, and **a board is a *view*
over items** — not a container.

## Core architectural decision

**Cards keep a single "home" board; cross-project boards are *views* over canonical status.**

A card still lives on exactly one board (a project board or a standalone board) via its
column — this preserves ordering, standalone quick-boards, and per-board card keys with a
minimal migration. What unlocks the sprint board is that every card also carries:

- a **canonical `statusId`** (workspace-level status vocabulary), and
- an optional **`sprintId`**.

So a cross-project view can query by sprint/project/assignee and **group by canonical status**
without the card belonging to that board. This is the Jira model: an issue *has* a status; a
board *maps* statuses to columns.

### Locked decisions

1. **Status model:** a canonical, per-workspace status set (`WorkspaceStatus`), with each
   board's columns mapped to a status. Not free-form-per-board (that would break the
   cross-project view's coherence).
2. **Sprints:** workspace/team-level (required so one sprint can span projects), **opt-in per
   project** (`Project.sprintsEnabled`).
3. **Several boards per project** allowed (`Board.projectId`, nullable).
4. **Standalone quick boards** kept (`Board.projectId = null`).
5. **Label filtering on the sprint board:** launch **without** it; add later once labels go
   workspace-level (Phase 5). Labels are board-scoped today.
6. **Standalone-board cards on the sprint board:** **included** (sprint and project are
   independent axes); they show project "—".

### Status/column sync rule (app logic)

- Moving a card between columns on its **home board** sets `card.statusId = column.statusId`.
- Moving a card between status-columns on the **sprint board** sets `card.statusId` directly
  (and, if the home board has a column mapped to that status, moves it there too).
- Status is denormalized onto the card because a card can be in a status its home board
  doesn't show as a column.

We deliberately do **not** add `Card.projectId`: a card's project derives from
`board.projectId` (via `column → board`). Denormalize onto the card only if the cross-project
query proves too slow (Phase-4 perf option, not a commitment).

## Data-model diff

Two new models, five changed. Grounded in the current schema.

### New

```prisma
// Canonical, per-workspace status vocabulary. Boards map their columns to these;
// cross-project views group by them. Seeded with defaults, admin-editable.
model WorkspaceStatus {
  id          String    @id @default(cuid())
  workspaceId String
  name        String              // "Backlog" · "To do" · "In progress" · "In review" · "Done"
  category    String    @default("active") // todo / active / done — done-detection & WIP
  position    String              // fractional-index ordering (lib/ordering.ts)
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  columns     Column[]
  cards       Card[]

  @@unique([workspaceId, name])
  @@index([workspaceId, position])
}

// Workspace/team-level, time-boxed. Independent of a project's ADDIE/SAM phases.
model Sprint {
  id          String    @id @default(cuid())
  workspaceId String
  name        String
  goal        String?
  status      String    @default("planned") // planned / active / completed
  startDate   DateTime?
  endDate     DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  cards       Card[]

  @@index([workspaceId, status])
}
```

### Changed (additions marked `+`)

```prisma
model Workspace {
+ statuses       WorkspaceStatus[]
+ sprints        Sprint[]
}

model Project {
+ boards         Board[]                  // several boards per project
+ sprintsEnabled Boolean @default(false)  // opt-in per project (Phase 3)
}

model Board {
+ projectId String?                       // null = standalone quick board
+ project   Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
+ @@index([projectId])
}

model Column {
+ statusId String?                        // which canonical status this column represents
+ status   WorkspaceStatus? @relation(fields: [statusId], references: [id], onDelete: SetNull)
}

model Card {
+ statusId String?                        // canonical status (source of truth for cross-board views)
+ status   WorkspaceStatus? @relation(fields: [statusId], references: [id], onDelete: SetNull)
+ sprintId String?                        // optional sprint assignment (Phase 3)
+ sprint   Sprint? @relation(fields: [sprintId], references: [id], onDelete: SetNull)
+ @@index([statusId])
+ @@index([sprintId])
}
```

`Sprint`, `Card.sprintId`, and `Project.sprintsEnabled` land in Phase 3, not Phase 0.

## Migration / backfill (the risky part)

Additive columns are cheap; the data backfill needs care.

1. **Seed statuses** — one default set per workspace: Backlog · To do · In progress ·
   In review · Done.
2. **Map columns → statuses** — case-insensitive name match to the seeded set; unmatched
   columns fall back to "In progress." Imperfect, so ship an **admin "remap columns" UI** to
   correct it. (Rejected alternative: a status per distinct column name — explodes the
   canonical set and defeats cross-project coherence.)
3. **Backfill `card.statusId`** = its column's mapped status (`null` for subtasks; they
   inherit the parent's).
4. **`board.projectId`** — leave `null` on all existing boards (everything starts
   standalone); no reliable signal to auto-assign today. Provide a **"Move board to project"
   action** instead of guessing.

## Phased plan

Each phase is independently shippable and useful on its own.

| Phase | Deliverable | Risk | Value |
|---|---|---|---|
| **0 — Foundations** | `WorkspaceStatus` + seed; `Column.statusId` + `Card.statusId` + backfill; `Board.projectId`. Boards keep working unchanged. | Low–Med (backfill) | Substrate for the rest. |
| **1 — Projects drive Boards** | Wire `Board.projectId` into UI: create/list a project's boards from the project page; breadcrumb Project → Board; keep top-level Boards nav for standalone boards. | Low | The core ask. |
| **2 — Filter bar** | Shared filter UI on any board (assignee / status / due), server-side, visibility-aware. | Low–Med | Useful standalone; de-risks Phase 4. |
| **3 — Sprints** | `Sprint` + `Card.sprintId` + `Project.sprintsEnabled`; sprint create/close UI; assign cards to a sprint. | Med | Sprint planning (fits SAM iterations). |
| **4 — Team Sprint Board** | Cross-project view: pick a sprint → all cards across projects grouped by canonical status; filter by assignee / status / project; includes standalone-board cards; drag updates `statusId`. Visibility-enforced. | Med | The payoff. |
| **5 — optional** | ~~Workspace-level labels (cross-project label filtering)~~ **shipped 2026-08-12** + saved filter views *(outstanding)*. | Med | Polish / power-user. |

Stop-anywhere: after Phase 1 you already have "Projects drive Boards."

## Open items / deferred
- ~~**Labels → workspace-level** (Phase 5) before the sprint board can filter by label.~~
  **Done 2026-08-12** — `Label.boardId` → `Label.workspaceId`, unique per workspace
  case-insensitively, same-named labels across boards merged by the
  `workspace_level_labels` migration (most-used wins, tie-broken by id). The sprint board
  filters by label; admins manage them in Settings → Labels. Restore upgrades pre-format-4
  backups in `upgradeLegacyLabels`.
- **Saved views / filters** (Phase 5) — still outstanding.
- **Card.projectId denormalization** — only if cross-project query perf demands it.
- Access control: every cross-project query MUST spread the existing visibility fragments
  (`boardVisibilityWhere` / `projectVisibilityWhere`) so restricted resources don't leak.
