"use client";

import { useState, useTransition, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, ChevronRight, X, MessageSquare, Paperclip, ListChecks } from "lucide-react";
import {
  createCard,
  deleteCard,
  createColumn,
  renameColumn,
  deleteColumn,
  moveColumn,
  moveCard,
  renameBoard,
  deleteBoard,
  setBoardCardKeyPrefix,
} from "@/app/actions/boards";
import { CardDrawer, type CardFacePatch } from "@/components/board/card-drawer";
import { FilterBar, type DueFilter } from "@/components/board/filter-bar";
import { useSetPageTitle } from "@/components/app-shell/breadcrumbs";
import { InlineTitle } from "@/components/shared/inline-title";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Label = { id: string; name: string; color: string };
type Member = { id: string; name: string | null; email: string };
type Card = {
  id: string;
  title: string;
  description: string | null;
  position: string;
  dueDate: string | null;
  keySeq: number | null;
  labels: Label[];
  assignees: Member[];
  checklist: { total: number; done: number };
  comments: number;
  attachments: number;
};
type Column = { id: string; name: string; position: string; cards: Card[] };

export function BoardView({
  boardId,
  boardName,
  cardKeyPrefix,
  initialColumns,
}: {
  boardId: string;
  boardName: string;
  cardKeyPrefix: string | null;
  initialColumns: Column[];
}) {
  const [columns, setColumns] = useState<Column[]>(initialColumns);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // Seeds from ?card=<id> so links from elsewhere (e.g. My Work's subtasks
  // section) land straight on the right card's drawer, not just the board.
  // The stack lets a subtask's drawer open "on top of" its parent's: opening
  // a top-level card resets the stack, opening/returning to a subtask id
  // pushes/pops it — nesting is capped at one level so the stack never grows
  // past 2 entries in practice.
  const [cardStack, setCardStack] = useState<string[]>(() => {
    const c = searchParams.get("card");
    return c ? [c] : [];
  });
  const openCardId = cardStack.length > 0 ? cardStack[cardStack.length - 1] : null;
  const [, startTransition] = useTransition();

  function openCard(cardId: string) {
    setCardStack([cardId]);
  }

  function navigateCard(cardId: string) {
    setCardStack((prev) => {
      const idx = prev.indexOf(cardId);
      // already in the stack (e.g. the subtask's "back to parent" link) -> pop back to it
      if (idx >= 0) return prev.slice(0, idx + 1);
      return [...prev, cardId];
    });
  }

  function closeDrawer() {
    setCardStack([]);
    if (searchParams.get("card")) router.replace(pathname, { scroll: false });
  }

  // ── Filters: a client-side view over the already-loaded cards ──
  const [fLabels, setFLabels] = useState<Set<string>>(new Set());
  const [fAssignees, setFAssignees] = useState<Set<string>>(new Set());
  const [fDue, setFDue] = useState<DueFilter>("any");
  const [search, setSearch] = useState("");

  const availableLabels = useMemo(() => {
    const map = new Map<string, Label>();
    columns.forEach((c) => c.cards.forEach((card) => card.labels.forEach((l) => map.set(l.id, l))));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [columns]);

  const availableMembers = useMemo(() => {
    const map = new Map<string, Member>();
    columns.forEach((c) => c.cards.forEach((card) => card.assignees.forEach((a) => map.set(a.id, a))));
    return [...map.values()].sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));
  }, [columns]);

  const filtersActive = fLabels.size > 0 || fAssignees.size > 0 || fDue !== "any" || search.trim() !== "";

  const filteredColumns = useMemo(() => {
    if (!filtersActive) return columns;
    const today = new Date().toISOString().slice(0, 10);
    const weekEnd = (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + 7);
      return d.toISOString().slice(0, 10);
    })();
    const q = search.trim().toLowerCase();
    const match = (card: Card) => {
      if (fLabels.size > 0 && !card.labels.some((l) => fLabels.has(l.id))) return false;
      if (fAssignees.size > 0 && !card.assignees.some((a) => fAssignees.has(a.id))) return false;
      if (fDue !== "any") {
        const ymd = card.dueDate ? card.dueDate.slice(0, 10) : null;
        if (fDue === "none" && ymd) return false;
        if (fDue === "overdue" && !(ymd && ymd < today)) return false;
        if (fDue === "week" && !(ymd && ymd >= today && ymd <= weekEnd)) return false;
      }
      if (q && !card.title.toLowerCase().includes(q)) return false;
      return true;
    };
    return columns.map((c) => ({ ...c, cards: c.cards.filter(match) }));
  }, [columns, fLabels, fAssignees, fDue, search, filtersActive]);

  const totalCount = useMemo(() => columns.reduce((n, c) => n + c.cards.length, 0), [columns]);
  const visibleCount = useMemo(
    () => filteredColumns.reduce((n, c) => n + c.cards.length, 0),
    [filteredColumns],
  );

  function toggleSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearFilters() {
    setFLabels(new Set());
    setFAssignees(new Set());
    setFDue("any");
    setSearch("");
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const colOfCard = (cardId: string, cols: Column[]) =>
    cols.find((c) => c.cards.some((card) => card.id === cardId));

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    setActiveCard(colOfCard(id, columns)?.cards.find((c) => c.id === id) ?? null);
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    setColumns((prev) => {
      const from = colOfCard(activeId, prev);
      if (!from) return prev;
      const to = prev.find((c) => c.id === overId) ?? colOfCard(overId, prev);
      if (!to || to.id === from.id) return prev;

      const card = from.cards.find((c) => c.id === activeId)!;
      const overCardIndex = to.cards.findIndex((c) => c.id === overId);
      const insertAt = overCardIndex >= 0 ? overCardIndex : to.cards.length;

      return prev.map((c) => {
        if (c.id === from.id) return { ...c, cards: c.cards.filter((x) => x.id !== activeId) };
        if (c.id === to.id)
          return { ...c, cards: [...c.cards.slice(0, insertAt), card, ...c.cards.slice(insertAt)] };
        return c;
      });
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveCard(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    let working = columns;
    const activeCol = colOfCard(activeId, working);
    if (!activeCol) return;
    const overCol = working.find((c) => c.id === overId) ?? colOfCard(overId, working);
    if (!overCol) return;

    if (activeCol.id === overCol.id) {
      const oldIndex = activeCol.cards.findIndex((c) => c.id === activeId);
      const newIndex = activeCol.cards.findIndex((c) => c.id === overId);
      if (newIndex >= 0 && oldIndex !== newIndex) {
        const reordered = arrayMove(activeCol.cards, oldIndex, newIndex);
        working = working.map((c) => (c.id === activeCol.id ? { ...c, cards: reordered } : c));
        setColumns(working);
      }
    }

    const finalCol = colOfCard(activeId, working)!;
    const finalIndex = finalCol.cards.findIndex((c) => c.id === activeId);
    startTransition(() => void moveCard(activeId, finalCol.id, finalIndex));
  }

  // ── Mutations (optimistic local state + persisted server action) ──

  async function handleAddCard(columnId: string, title: string) {
    const res = await createCard(columnId, title);
    if ("card" in res && res.card) {
      const card: Card = {
        id: res.card.id,
        title: res.card.title,
        description: res.card.description,
        position: res.card.position,
        dueDate: null,
        keySeq: res.card.keySeq,
        labels: [],
        assignees: [],
        checklist: { total: 0, done: 0 },
        comments: 0,
        attachments: 0,
      };
      setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, cards: [...c.cards, card] } : c)));
    }
  }

  function handleDeleteCard(cardId: string) {
    setColumns((prev) => prev.map((c) => ({ ...c, cards: c.cards.filter((x) => x.id !== cardId) })));
    startTransition(() => void deleteCard(cardId));
  }

  function patchCard(cardId: string, patch: CardFacePatch) {
    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        cards: col.cards.map((card) => (card.id === cardId ? { ...card, ...patch } : card)),
      })),
    );
  }

  async function handleAddColumn(name: string) {
    const res = await createColumn(boardId, name);
    if ("column" in res && res.column) {
      setColumns((prev) => [...prev, { ...res.column, cards: [] }]);
    }
  }

  function handleRenameColumn(columnId: string, name: string) {
    setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, name } : c)));
    startTransition(() => void renameColumn(columnId, name));
  }

  function handleDeleteColumn(columnId: string) {
    setColumns((prev) => prev.filter((c) => c.id !== columnId));
    startTransition(() => void deleteColumn(columnId));
  }

  function handleMoveColumn(columnId: string, dir: -1 | 1) {
    const index = columns.findIndex((c) => c.id === columnId);
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= columns.length) return;
    setColumns(arrayMove(columns, index, newIndex));
    startTransition(() => void moveColumn(columnId, newIndex));
  }

  return (
    <div className="flex h-full min-h-screen flex-col">
      <BoardHeader boardId={boardId} boardName={boardName} cardKeyPrefix={cardKeyPrefix} />

      <FilterBar
        labels={availableLabels}
        members={availableMembers}
        selectedLabels={fLabels}
        onToggleLabel={(id) => toggleSet(setFLabels, id)}
        selectedAssignees={fAssignees}
        onToggleAssignee={(id) => toggleSet(setFAssignees, id)}
        due={fDue}
        onDue={setFDue}
        search={search}
        onSearch={setSearch}
        active={filtersActive}
        onClear={clearFilters}
        visible={visibleCount}
        total={totalCount}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex flex-1 items-start gap-4 overflow-x-auto px-6 pb-10">
          {filteredColumns.map((col, i) => (
            <ColumnView
              key={col.id}
              column={col}
              cardKeyPrefix={cardKeyPrefix}
              canMoveLeft={i > 0}
              canMoveRight={i < filteredColumns.length - 1}
              dragDisabled={filtersActive}
              onAddCard={handleAddCard}
              onDeleteCard={handleDeleteCard}
              onOpenCard={openCard}
              onRename={handleRenameColumn}
              onDelete={handleDeleteColumn}
              onMove={handleMoveColumn}
            />
          ))}
          <AddColumn onAdd={handleAddColumn} />
        </div>

        <DragOverlay>{activeCard ? <CardShell card={activeCard} cardKeyPrefix={cardKeyPrefix} dragging /> : null}</DragOverlay>
      </DndContext>

      {openCardId && (
        <CardDrawer
          cardId={openCardId}
          onClose={closeDrawer}
          onPatch={patchCard}
          onDeleted={handleDeleteCard}
          onNavigate={navigateCard}
        />
      )}
    </div>
  );
}

function BoardHeader({
  boardId,
  boardName,
  cardKeyPrefix,
}: {
  boardId: string;
  boardName: string;
  cardKeyPrefix: string | null;
}) {
  const [name, setName] = useState(boardName);
  const [prefix, setPrefix] = useState(cardKeyPrefix ?? "");
  const [prefixError, setPrefixError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  useSetPageTitle(name);

  function commitPrefix() {
    const next = prefix.trim().toUpperCase();
    setPrefix(next);
    if (next === (cardKeyPrefix ?? "")) return;
    startTransition(async () => {
      const res = await setBoardCardKeyPrefix(boardId, next);
      if ("error" in res && res.error) {
        setPrefixError(res.error);
        setPrefix(cardKeyPrefix ?? ""); // revert — the server rejected it
      } else {
        setPrefixError(null);
      }
    });
  }

  return (
    <header className="flex items-center justify-between gap-4 px-6 py-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <InlineTitle
          value={name}
          onChange={setName}
          onCommit={() => {
            if (name.trim() && name !== boardName) startTransition(() => void renameBoard(boardId, name));
          }}
          ariaLabel="Board name"
        />
        <div className="flex shrink-0 flex-col">
          <div className="flex items-center gap-1.5">
            <label htmlFor="card-key-prefix" className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Card prefix
            </label>
            {!cardKeyPrefix && !prefix && (
              <span className="text-[10px] text-muted-foreground">— cards get labels like WP-1 once set</span>
            )}
          </div>
          <input
            id="card-key-prefix"
            value={prefix}
            onChange={(e) => {
              setPrefix(e.target.value.toUpperCase());
              setPrefixError(null);
            }}
            onBlur={commitPrefix}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            placeholder="e.g. WP"
            maxLength={8}
            className={`w-24 rounded-md border bg-surface px-2 py-1 text-sm font-medium tracking-wide outline-none hover:bg-hover focus:bg-hover ${
              prefixError ? "border-destructive" : "border-border-strong"
            }`}
          />
        </div>
        {prefixError && <span className="text-xs text-destructive">{prefixError}</span>}
      </div>
      <ConfirmDelete
        title="Delete this board?"
        description="This permanently deletes the board and all of its columns and cards."
        confirmLabel="Delete board"
        onConfirm={() => deleteBoard(boardId)}
        trigger={
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            Delete board
          </Button>
        }
      />
    </header>
  );
}

function ColumnView({
  column,
  cardKeyPrefix,
  canMoveLeft,
  canMoveRight,
  dragDisabled,
  onAddCard,
  onDeleteCard,
  onOpenCard,
  onRename,
  onDelete,
  onMove,
}: {
  column: Column;
  cardKeyPrefix: string | null;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  dragDisabled: boolean;
  onAddCard: (columnId: string, title: string) => void;
  onDeleteCard: (cardId: string) => void;
  onOpenCard: (cardId: string) => void;
  onRename: (columnId: string, name: string) => void;
  onDelete: (columnId: string) => void;
  onMove: (columnId: string, dir: -1 | 1) => void;
}) {
  const { setNodeRef } = useDroppable({ id: column.id, data: { type: "column" } });
  const [name, setName] = useState(column.name);

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-surface-muted">
      <div className="flex items-center gap-1 px-3 pt-3">
        <InlineTitle
          value={name}
          onChange={setName}
          onCommit={() => name.trim() && name !== column.name && onRename(column.id, name.trim())}
          ariaLabel="Column name"
          className="text-sm font-medium tracking-normal"
        />
        <span className="shrink-0 text-xs text-muted-foreground">{column.cards.length}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={!canMoveLeft}
          onClick={() => onMove(column.id, -1)}
          className="text-muted-foreground"
          title="Move left"
          aria-label="Move column left"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={!canMoveRight}
          onClick={() => onMove(column.id, 1)}
          className="text-muted-foreground"
          title="Move right"
          aria-label="Move column right"
        >
          <ChevronRight className="size-3.5" />
        </Button>
        <ConfirmDelete
          title="Delete this column?"
          description="This permanently deletes the column and all of its cards."
          confirmLabel="Delete column"
          onConfirm={() => onDelete(column.id)}
          trigger={
            <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-destructive" title="Delete column" aria-label="Delete column">
              <X className="size-3.5" />
            </Button>
          }
        />
      </div>

      <div ref={setNodeRef} className="flex flex-col gap-2 p-3">
        <SortableContext items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              cardKeyPrefix={cardKeyPrefix}
              disabled={dragDisabled}
              onDelete={onDeleteCard}
              onOpen={onOpenCard}
            />
          ))}
        </SortableContext>
        <CardComposer onAdd={(title) => onAddCard(column.id, title)} />
      </div>
    </div>
  );
}

function SortableCard({
  card,
  cardKeyPrefix,
  disabled,
  onDelete,
  onOpen,
}: {
  card: Card;
  cardKeyPrefix: string | null;
  disabled: boolean;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card" },
    disabled,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardShell card={card} cardKeyPrefix={cardKeyPrefix} onDelete={() => onDelete(card.id)} onOpen={() => onOpen(card.id)} />
    </div>
  );
}

function initials(m: Member) {
  const base = m.name?.trim() || m.email;
  const parts = base.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || base[0]?.toUpperCase();
}

function dueInfo(iso: string) {
  // Due dates are calendar dates stored as UTC midnight — format/compare in UTC
  // so the displayed day doesn't shift with the viewer's timezone.
  const ymd = iso.slice(0, 10);
  const [y, m, day] = ymd.split("-").map(Number);
  const label = new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const overdue = ymd < new Date().toISOString().slice(0, 10);
  return { label, overdue };
}

function CardShell({
  card,
  cardKeyPrefix,
  onDelete,
  onOpen,
  dragging,
}: {
  card: Card;
  cardKeyPrefix: string | null;
  onDelete?: () => void;
  onOpen?: () => void;
  dragging?: boolean;
}) {
  const due = card.dueDate ? dueInfo(card.dueDate) : null;
  return (
    <div
      onClick={onOpen}
      className={`group flex flex-col gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-sm ${
        dragging ? "rotate-1 shadow-md" : "cursor-pointer active:cursor-grabbing"
      }`}
    >
      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.labels.map((l) => (
            <span key={l.id} className="h-2 w-8 rounded-full" style={{ backgroundColor: l.color }} title={l.name} />
          ))}
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <span className="whitespace-pre-wrap break-words">
          {cardKeyPrefix && card.keySeq != null && (
            <span className="mr-1.5 font-mono text-xs font-medium text-muted-foreground">
              {cardKeyPrefix}-{card.keySeq}
            </span>
          )}
          {card.title}
        </span>
        {onDelete && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="shrink-0 rounded p-0.5 text-foreground/30 opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            title="Delete card"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {(due ||
        card.checklist.total > 0 ||
        card.comments > 0 ||
        card.attachments > 0 ||
        card.assignees.length > 0) && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {due && (
              <StatusBadge tone={due.overdue ? "danger" : "neutral"}>{due.label}</StatusBadge>
            )}
            {card.checklist.total > 0 && (
              <StatusBadge tone={card.checklist.done === card.checklist.total ? "success" : "neutral"}>
                <ListChecks className="size-3" />
                {card.checklist.done}/{card.checklist.total}
              </StatusBadge>
            )}
            {card.comments > 0 && (
              <StatusBadge tone="neutral">
                <MessageSquare className="size-3" />
                {card.comments}
              </StatusBadge>
            )}
            {card.attachments > 0 && (
              <StatusBadge tone="neutral">
                <Paperclip className="size-3" />
                {card.attachments}
              </StatusBadge>
            )}
          </div>
          {card.assignees.length > 0 && (
            <div className="flex -space-x-1">
              {card.assignees.slice(0, 3).map((a) => (
                <span
                  key={a.id}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-background bg-accent text-[10px] font-medium text-accent-foreground"
                  title={a.name ?? a.email}
                >
                  {initials(a)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CardComposer({ onAdd }: { onAdd: (title: string) => void }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-lg px-2 py-1.5 text-left text-sm text-foreground/50 hover:bg-hover">
        + Add a card
      </button>
    );
  }

  function submit() {
    const title = value.trim();
    if (title) onAdd(title);
    setValue("");
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") {
            setValue("");
            setOpen(false);
          }
        }}
        rows={2}
        placeholder="Card title…"
        className="min-h-0 resize-none bg-surface"
      />
      <div className="flex gap-2">
        <Button size="xs" onClick={submit}>Add</Button>
        <Button size="xs" variant="ghost" onClick={() => { setValue(""); setOpen(false); }}>Cancel</Button>
      </div>
    </div>
  );
}

function AddColumn({ onAdd }: { onAdd: (name: string) => void }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-72 shrink-0 rounded-xl border border-dashed border-border-strong px-3 py-3 text-left text-sm text-foreground/50 hover:border-foreground/40">
        + Add a column
      </button>
    );
  }

  function submit() {
    const name = value.trim();
    if (name) onAdd(name);
    setValue("");
    setOpen(false);
  }

  return (
    <div className="flex w-72 shrink-0 flex-col gap-1.5 rounded-xl border border-border p-3">
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") { setValue(""); setOpen(false); }
        }}
        placeholder="Column name…"
        className="bg-surface"
      />
      <div className="flex gap-2">
        <Button size="xs" onClick={submit}>Add column</Button>
        <Button size="xs" variant="ghost" onClick={() => { setValue(""); setOpen(false); }}>Cancel</Button>
      </div>
    </div>
  );
}
