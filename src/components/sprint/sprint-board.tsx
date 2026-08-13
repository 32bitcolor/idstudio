"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import { setCardStatus } from "@/app/actions/boards";
import { useSetPageTitle } from "@/components/app-shell/breadcrumbs";
import { CardDrawer, type CardFacePatch } from "@/components/board/card-drawer";
import { AddCardsDialog } from "@/components/sprint/add-cards-dialog";
import { Select } from "@/components/ui/select";
import { SavedViewsMenu } from "@/components/shared/saved-views-menu";
import type { SavedViewDTO } from "@/app/actions/saved-views";
import type { SprintFilters } from "@/lib/saved-views";
import { dueMeta, dueToneClass } from "@/lib/due";

type Person = { id: string; name: string | null; email: string };
export type SprintCard = {
  id: string;
  title: string;
  keySeq: number | null;
  statusId: string | null;
  dueDate: string | null;
  boardId: string;
  cardKeyPrefix: string | null;
  project: { id: string; name: string } | null;
  assignees: Person[];
  labels: LabelT[];
};
type StatusT = { id: string; name: string };
type LabelT = { id: string; name: string; color: string };

const NO_STATUS = "__none__";
const NO_PROJECT = "__noproject__";
const UNASSIGNED = "__unassigned__";
const NO_LABEL = "__nolabel__";

export function SprintBoard({
  sprint,
  statuses,
  initialCards,
}: {
  sprint: { id: string; name: string; goal: string | null; status: string };
  statuses: StatusT[];
  initialCards: SprintCard[];
}) {
  const [cards, setCards] = useState<SprintCard[]>(initialCards);
  const [projectFilter, setProjectFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  // See board-view: the active view detaches as soon as a filter is hand-edited.
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<SprintCard | null>(null);
  useSetPageTitle(sprint.name);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleCardPatch(cardId: string, patch: CardFacePatch) {
    setCards((cs) =>
      cs.map((c) =>
        c.id === cardId
          ? {
              ...c,
              ...(patch.title !== undefined ? { title: patch.title } : {}),
              ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
              ...(patch.assignees !== undefined ? { assignees: patch.assignees } : {}),
            }
          : c,
      ),
    );
  }

  function currentFilters() {
    return { project: projectFilter, assignee: assigneeFilter, label: labelFilter };
  }

  function applyView(view: SavedViewDTO | null) {
    if (!view) {
      setProjectFilter("");
      setAssigneeFilter("");
      setLabelFilter("");
      setActiveViewId(null);
      return;
    }
    const f = view.filters as SprintFilters;
    setProjectFilter(f.project);
    setAssigneeFilter(f.assignee);
    setLabelFilter(f.label);
    setActiveViewId(view.id);
  }

  function handleCardDeleted(cardId: string) {
    setCards((cs) => cs.filter((c) => c.id !== cardId));
    setOpenCardId(null);
  }

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    let hasNone = false;
    cards.forEach((c) => (c.project ? map.set(c.project.id, c.project.name) : (hasNone = true)));
    return { list: [...map.entries()].sort((a, b) => a[1].localeCompare(b[1])), hasNone };
  }, [cards]);

  const people = useMemo(() => {
    const map = new Map<string, Person>();
    let hasUnassigned = false;
    cards.forEach((c) => (c.assignees.length ? c.assignees.forEach((a) => map.set(a.id, a)) : (hasUnassigned = true)));
    return { list: [...map.values()].sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email)), hasUnassigned };
  }, [cards]);

  // Labels are workspace-level, so a cross-project sprint board can finally filter by
  // them — the same label means the same thing on every project's board.
  const labels = useMemo(() => {
    const map = new Map<string, LabelT>();
    let hasNone = false;
    cards.forEach((c) => (c.labels.length ? c.labels.forEach((l) => map.set(l.id, l)) : (hasNone = true)));
    return { list: [...map.values()].sort((a, b) => a.name.localeCompare(b.name)), hasNone };
  }, [cards]);

  const visible = useMemo(() => {
    return cards.filter((c) => {
      if (projectFilter) {
        if (projectFilter === NO_PROJECT && c.project) return false;
        if (projectFilter !== NO_PROJECT && c.project?.id !== projectFilter) return false;
      }
      if (assigneeFilter) {
        if (assigneeFilter === UNASSIGNED && c.assignees.length) return false;
        if (assigneeFilter !== UNASSIGNED && !c.assignees.some((a) => a.id === assigneeFilter)) return false;
      }
      if (labelFilter) {
        if (labelFilter === NO_LABEL && c.labels.length) return false;
        if (labelFilter !== NO_LABEL && !c.labels.some((l) => l.id === labelFilter)) return false;
      }
      return true;
    });
  }, [cards, projectFilter, assigneeFilter, labelFilter]);

  const statusIds = useMemo(() => new Set(statuses.map((s) => s.id)), [statuses]);
  const needsNoStatus = visible.some((c) => !c.statusId || !statusIds.has(c.statusId));
  const columns = [
    ...statuses.map((s) => ({ id: s.id, name: s.name, droppable: true })),
    ...(needsNoStatus ? [{ id: NO_STATUS, name: "No status", droppable: false }] : []),
  ];

  function cardsFor(statusId: string) {
    if (statusId === NO_STATUS) return visible.filter((c) => !c.statusId || !statusIds.has(c.statusId));
    return visible.filter((c) => c.statusId === statusId);
  }

  async function changeStatus(card: SprintCard, statusId: string) {
    const prev = card.statusId;
    if (prev === statusId) return;
    setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, statusId } : c)));
    const res = await setCardStatus(card.id, statusId);
    if (res && "error" in res && res.error) {
      setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, statusId: prev } : c)));
    }
  }

  function onDragStart(e: DragStartEvent) {
    setActiveCard(cards.find((c) => c.id === String(e.active.id)) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = e;
    if (!over) return;
    const overId = String(over.id);
    if (!statusIds.has(overId)) return; // dropped outside a status column (e.g. "No status") — ignore
    const card = cards.find((c) => c.id === String(active.id));
    if (card) changeStatus(card, overId);
  }

  return (
    <div className="flex h-full min-h-screen min-w-0 flex-col">
      <header className="px-6 py-5">
        <Link href="/sprints" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline">
          <ArrowLeft className="size-3" /> Sprints
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{sprint.name}</h1>
        {sprint.goal && <p className="mt-0.5 text-sm text-muted-foreground">{sprint.goal}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select value={projectFilter} onChange={(e) => { setActiveViewId(null); setProjectFilter(e.target.value); }} className="h-8 w-auto py-1 text-xs">
            <option value="">All projects</option>
            {projects.list.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
            {projects.hasNone && <option value={NO_PROJECT}>No project</option>}
          </Select>
          <Select value={assigneeFilter} onChange={(e) => { setActiveViewId(null); setAssigneeFilter(e.target.value); }} className="h-8 w-auto py-1 text-xs">
            <option value="">All assignees</option>
            {people.list.map((p) => (
              <option key={p.id} value={p.id}>{p.name ?? p.email}</option>
            ))}
            {people.hasUnassigned && <option value={UNASSIGNED}>Unassigned</option>}
          </Select>
          <Select value={labelFilter} onChange={(e) => { setActiveViewId(null); setLabelFilter(e.target.value); }} className="h-8 w-auto py-1 text-xs">
            <option value="">All labels</option>
            {labels.list.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
            {labels.hasNone && <option value={NO_LABEL}>No label</option>}
          </Select>
          <SavedViewsMenu
            scope="sprint"
            currentFilters={currentFilters}
            filtersActive={!!(projectFilter || assigneeFilter || labelFilter)}
            activeViewId={activeViewId}
            onApply={applyView}
          />
          <span className="text-xs text-muted-foreground">{visible.length} of {cards.length} cards</span>
          <div className="ml-auto">
            <AddCardsDialog sprintId={sprint.id} onAdded={(card) => setCards((cs) => [card, ...cs])} />
          </div>
        </div>
      </header>

      {cards.length === 0 && (
        <p className="mx-6 mb-3 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
          No cards assigned yet. Open any board, click a card, and set its{" "}
          <span className="font-medium text-foreground">Sprint</span> field to this sprint — it&rsquo;ll appear here.
        </p>
      )}

      {columns.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex flex-1 gap-3 overflow-x-auto px-6 pb-6">
            {columns.map((col) => (
              <StatusColumn key={col.id} id={col.id} name={col.name} droppable={col.droppable} count={cardsFor(col.id).length}>
                {cardsFor(col.id).map((c) => (
                  <SprintCardCell
                    key={c.id}
                    card={c}
                    statuses={statuses}
                    hasStatus={statusIds.has(c.statusId ?? "")}
                    onOpen={() => setOpenCardId(c.id)}
                    onChangeStatus={(statusId) => changeStatus(c, statusId)}
                  />
                ))}
                {cardsFor(col.id).length === 0 && <p className="px-1.5 py-2 text-xs text-muted-foreground">—</p>}
              </StatusColumn>
            ))}
          </div>

          <DragOverlay>
            {activeCard ? (
              <div className="w-64 rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-lg">
                {activeCard.cardKeyPrefix && activeCard.keySeq != null && (
                  <span className="mr-1.5 font-mono text-xs font-medium text-muted-foreground">
                    {activeCard.cardKeyPrefix}-{activeCard.keySeq}
                  </span>
                )}
                {activeCard.title}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {openCardId && (
        <CardDrawer
          cardId={openCardId}
          onClose={() => setOpenCardId(null)}
          onPatch={handleCardPatch}
          onDeleted={handleCardDeleted}
          onNavigate={(id) => setOpenCardId(id)}
        />
      )}
    </div>
  );
}

function StatusColumn({
  id,
  name,
  droppable,
  count,
  children,
}: {
  id: string;
  name: string;
  droppable: boolean;
  count: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !droppable });
  return (
    <div
      ref={droppable ? setNodeRef : undefined}
      className={`flex w-72 shrink-0 flex-col rounded-xl p-2 transition-colors ${isOver ? "bg-accent/10 ring-1 ring-accent/40" : "bg-muted/40"}`}
    >
      <div className="flex items-center justify-between px-1.5 py-1 text-sm font-medium">
        <span>{name}</span>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="flex min-h-2 flex-col gap-2">{children}</div>
    </div>
  );
}

function SprintCardCell({
  card,
  statuses,
  hasStatus,
  onOpen,
  onChangeStatus,
}: {
  card: SprintCard;
  statuses: StatusT[];
  hasStatus: boolean;
  onOpen: () => void;
  onChangeStatus: (statusId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });
  const due = card.dueDate ? dueMeta(card.dueDate) : null;
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-sm ${isDragging ? "opacity-40" : "cursor-grab active:cursor-grabbing"}`}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left hover:underline">
        {card.cardKeyPrefix && card.keySeq != null && (
          <span className="mr-1.5 font-mono text-xs font-medium text-muted-foreground">
            {card.cardKeyPrefix}-{card.keySeq}
          </span>
        )}
        {card.title}
      </button>
      {card.labels.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {card.labels.map((l) => (
            <span
              key={l.id}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: l.color }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {card.project && (
          <span className="truncate rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground" title={`Project: ${card.project.name}`}>
            {card.project.name}
          </span>
        )}
        {due && <span className={`text-[11px] ${dueToneClass[due.tone]}`}>{due.label}</span>}
        {card.assignees.length > 0 && (
          <span className="ml-auto flex -space-x-1.5">
            {card.assignees.slice(0, 3).map((a) => (
              <span
                key={a.id}
                className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium ring-1 ring-surface"
                title={a.name ?? a.email}
              >
                {(a.name ?? a.email).charAt(0).toUpperCase()}
              </span>
            ))}
          </span>
        )}
      </div>
      {/* stop pointer events reaching the drag sensor so the dropdown opens cleanly */}
      <Select
        value={hasStatus ? card.statusId! : ""}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => e.target.value && onChangeStatus(e.target.value)}
        className="mt-2 h-7 w-full py-0.5 text-xs"
        aria-label="Card status"
      >
        {!hasStatus && <option value="">No status</option>}
        {statuses.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </Select>
    </div>
  );
}
