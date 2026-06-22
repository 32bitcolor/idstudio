"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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
} from "@/app/actions/boards";
import { CardDrawer, type CardFacePatch } from "@/components/board/card-drawer";

type Label = { id: string; name: string; color: string };
type Member = { id: string; name: string | null; email: string };
type Card = {
  id: string;
  title: string;
  description: string | null;
  position: string;
  dueDate: string | null;
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
  initialColumns,
}: {
  boardId: string;
  boardName: string;
  initialColumns: Column[];
}) {
  const [columns, setColumns] = useState<Column[]>(initialColumns);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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
    if (!confirm("Delete this column and all its cards?")) return;
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
      <BoardHeader boardId={boardId} boardName={boardName} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex flex-1 items-start gap-4 overflow-x-auto px-6 pb-10">
          {columns.map((col, i) => (
            <ColumnView
              key={col.id}
              column={col}
              canMoveLeft={i > 0}
              canMoveRight={i < columns.length - 1}
              onAddCard={handleAddCard}
              onDeleteCard={handleDeleteCard}
              onOpenCard={setOpenCardId}
              onRename={handleRenameColumn}
              onDelete={handleDeleteColumn}
              onMove={handleMoveColumn}
            />
          ))}
          <AddColumn onAdd={handleAddColumn} />
        </div>

        <DragOverlay>{activeCard ? <CardShell card={activeCard} dragging /> : null}</DragOverlay>
      </DndContext>

      {openCardId && (
        <CardDrawer
          cardId={openCardId}
          onClose={() => setOpenCardId(null)}
          onPatch={patchCard}
          onDeleted={handleDeleteCard}
        />
      )}
    </div>
  );
}

function BoardHeader({ boardId, boardName }: { boardId: string; boardName: string }) {
  const [name, setName] = useState(boardName);
  const [, startTransition] = useTransition();

  return (
    <header className="flex items-center justify-between gap-4 px-6 py-5">
      <div className="flex items-center gap-3">
        <Link href="/boards" className="text-sm text-foreground/60 hover:underline">
          ← Boards
        </Link>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name !== boardName) startTransition(() => void renameBoard(boardId, name));
          }}
          className="rounded-md bg-transparent px-1 text-lg font-semibold tracking-tight outline-none hover:bg-black/[.04] focus:bg-black/[.04] dark:hover:bg-white/[.06] dark:focus:bg-white/[.06]"
        />
      </div>
      <form
        action={async () => {
          if (confirm("Delete this entire board?")) await deleteBoard(boardId);
        }}
      >
        <button className="rounded-md border border-black/10 dark:border-white/15 px-3 py-1.5 text-sm text-red-600 hover:bg-red-500/5">
          Delete board
        </button>
      </form>
    </header>
  );
}

function ColumnView({
  column,
  canMoveLeft,
  canMoveRight,
  onAddCard,
  onDeleteCard,
  onOpenCard,
  onRename,
  onDelete,
  onMove,
}: {
  column: Column;
  canMoveLeft: boolean;
  canMoveRight: boolean;
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
    <div className="flex w-72 shrink-0 flex-col rounded-xl border border-black/10 dark:border-white/15 bg-black/[.015] dark:bg-white/[.02]">
      <div className="flex items-center gap-1 px-3 pt-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== column.name && onRename(column.id, name.trim())}
          className="min-w-0 flex-1 rounded bg-transparent px-1 text-sm font-medium outline-none hover:bg-black/[.04] focus:bg-black/[.04] dark:hover:bg-white/[.06]"
        />
        <span className="shrink-0 text-xs text-foreground/40">{column.cards.length}</span>
        <button disabled={!canMoveLeft} onClick={() => onMove(column.id, -1)} className="rounded px-1 text-foreground/50 hover:bg-black/[.06] disabled:opacity-25 dark:hover:bg-white/[.08]" title="Move left">
          ◀
        </button>
        <button disabled={!canMoveRight} onClick={() => onMove(column.id, 1)} className="rounded px-1 text-foreground/50 hover:bg-black/[.06] disabled:opacity-25 dark:hover:bg-white/[.08]" title="Move right">
          ▶
        </button>
        <button onClick={() => onDelete(column.id)} className="rounded px-1 text-foreground/50 hover:bg-red-500/10 hover:text-red-600" title="Delete column">
          ×
        </button>
      </div>

      <div ref={setNodeRef} className="flex flex-col gap-2 p-3">
        <SortableContext items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => (
            <SortableCard key={card.id} card={card} onDelete={onDeleteCard} onOpen={onOpenCard} />
          ))}
        </SortableContext>
        <CardComposer onAdd={(title) => onAddCard(column.id, title)} />
      </div>
    </div>
  );
}

function SortableCard({
  card,
  onDelete,
  onOpen,
}: {
  card: Card;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card" },
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardShell card={card} onDelete={() => onDelete(card.id)} onOpen={() => onOpen(card.id)} />
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
  onDelete,
  onOpen,
  dragging,
}: {
  card: Card;
  onDelete?: () => void;
  onOpen?: () => void;
  dragging?: boolean;
}) {
  const due = card.dueDate ? dueInfo(card.dueDate) : null;
  return (
    <div
      onClick={onOpen}
      className={`group flex flex-col gap-2 rounded-lg border border-black/10 dark:border-white/15 bg-background px-3 py-2 text-sm shadow-sm ${
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
        <span className="whitespace-pre-wrap break-words">{card.title}</span>
        {onDelete && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="shrink-0 rounded px-1 text-foreground/30 opacity-0 hover:bg-red-500/10 hover:text-red-600 group-hover:opacity-100"
            title="Delete card"
          >
            ×
          </button>
        )}
      </div>
      {(due ||
        card.checklist.total > 0 ||
        card.comments > 0 ||
        card.attachments > 0 ||
        card.assignees.length > 0) && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-xs text-foreground/60">
            {due && (
              <span className={`rounded px-1.5 py-0.5 ${due.overdue ? "bg-red-500/15 text-red-600" : "bg-black/[.05] dark:bg-white/[.08]"}`}>
                {due.label}
              </span>
            )}
            {card.checklist.total > 0 && (
              <span
                className={`rounded px-1.5 py-0.5 ${
                  card.checklist.done === card.checklist.total
                    ? "bg-green-500/15 text-green-600"
                    : "bg-black/[.05] dark:bg-white/[.08]"
                }`}
              >
                ✓ {card.checklist.done}/{card.checklist.total}
              </span>
            )}
            {card.comments > 0 && (
              <span className="rounded bg-black/[.05] px-1.5 py-0.5 dark:bg-white/[.08]">💬 {card.comments}</span>
            )}
            {card.attachments > 0 && (
              <span className="rounded bg-black/[.05] px-1.5 py-0.5 dark:bg-white/[.08]">📎 {card.attachments}</span>
            )}
          </div>
          {card.assignees.length > 0 && (
            <div className="flex -space-x-1">
              {card.assignees.slice(0, 3).map((a) => (
                <span
                  key={a.id}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-background bg-foreground text-[10px] font-medium text-background"
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
      <button onClick={() => setOpen(true)} className="rounded-lg px-2 py-1.5 text-left text-sm text-foreground/50 hover:bg-black/[.04] dark:hover:bg-white/[.06]">
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
      <textarea
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
        className="resize-none rounded-lg border border-black/15 dark:border-white/20 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/60"
      />
      <div className="flex gap-2">
        <button onClick={submit} className="rounded-md bg-foreground px-3 py-1 text-xs font-medium text-background">
          Add
        </button>
        <button onClick={() => { setValue(""); setOpen(false); }} className="rounded-md px-2 py-1 text-xs text-foreground/60 hover:bg-black/[.04] dark:hover:bg-white/[.06]">
          Cancel
        </button>
      </div>
    </div>
  );
}

function AddColumn({ onAdd }: { onAdd: (name: string) => void }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-72 shrink-0 rounded-xl border border-dashed border-black/15 dark:border-white/20 px-3 py-3 text-left text-sm text-foreground/50 hover:border-foreground/40">
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
    <div className="flex w-72 shrink-0 flex-col gap-1.5 rounded-xl border border-black/10 dark:border-white/15 p-3">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") { setValue(""); setOpen(false); }
        }}
        placeholder="Column name…"
        className="rounded-md border border-black/15 dark:border-white/20 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/60"
      />
      <div className="flex gap-2">
        <button onClick={submit} className="rounded-md bg-foreground px-3 py-1 text-xs font-medium text-background">
          Add column
        </button>
        <button onClick={() => { setValue(""); setOpen(false); }} className="rounded-md px-2 py-1 text-xs text-foreground/60 hover:bg-black/[.04] dark:hover:bg-white/[.06]">
          Cancel
        </button>
      </div>
    </div>
  );
}
