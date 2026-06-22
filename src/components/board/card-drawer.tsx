"use client";

import { useEffect, useState } from "react";
import {
  getCardDetail,
  updateCardDescription,
  setCardDueDate,
  createLabel,
  toggleCardLabel,
  toggleCardAssignee,
} from "@/app/actions/cards";
import { renameCard, deleteCard } from "@/app/actions/boards";
import { DescriptionEditor } from "@/components/board/description-editor";

export type LabelT = { id: string; name: string; color: string };
export type MemberT = { id: string; name: string | null; email: string };
export type CardFacePatch = {
  title?: string;
  dueDate?: string | null;
  labels?: LabelT[];
  assignees?: { id: string; name: string | null; email: string }[];
};

const PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
];

export function CardDrawer({
  cardId,
  onClose,
  onPatch,
  onDeleted,
}: {
  cardId: string;
  onClose: () => void;
  onPatch: (cardId: string, patch: CardFacePatch) => void;
  onDeleted: (cardId: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [boardId, setBoardId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null); // ISO
  const [labelIds, setLabelIds] = useState<Set<string>>(new Set());
  const [assigneeIds, setAssigneeIds] = useState<Set<string>>(new Set());
  const [boardLabels, setBoardLabels] = useState<LabelT[]>([]);
  const [members, setMembers] = useState<MemberT[]>([]);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(PALETTE[4]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getCardDetail(cardId).then((d) => {
      if (!active || !d) return;
      setBoardId(d.boardId);
      setTitle(d.card.title);
      setDescription(d.card.description);
      setDueDate(d.card.dueDate);
      setLabelIds(new Set(d.card.labelIds));
      setAssigneeIds(new Set(d.card.assigneeIds));
      setBoardLabels(d.boardLabels);
      setMembers(d.members);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [cardId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function saveTitle() {
    const t = title.trim();
    if (!t) return;
    renameCard(cardId, t);
    onPatch(cardId, { title: t });
  }

  function saveDescription(json: string | null) {
    setDescription(json);
    updateCardDescription(cardId, json);
  }

  function changeDueDate(value: string) {
    const iso = value ? new Date(value).toISOString() : null;
    setDueDate(iso);
    setCardDueDate(cardId, iso);
    onPatch(cardId, { dueDate: iso });
  }

  function patchLabelsFace(nextIds: Set<string>) {
    onPatch(cardId, { labels: boardLabels.filter((l) => nextIds.has(l.id)) });
  }

  function toggleLabel(label: LabelT) {
    const on = !labelIds.has(label.id);
    const next = new Set(labelIds);
    if (on) next.add(label.id);
    else next.delete(label.id);
    setLabelIds(next);
    toggleCardLabel(cardId, label.id, on);
    patchLabelsFace(next);
  }

  async function addLabel() {
    const name = newLabelName.trim();
    if (!name || !boardId) return;
    const res = await createLabel(boardId, name, newLabelColor);
    if ("label" in res && res.label) {
      setBoardLabels((prev) => [...prev, res.label].sort((a, b) => a.name.localeCompare(b.name)));
      setNewLabelName("");
    }
  }

  function toggleAssignee(m: MemberT) {
    const on = !assigneeIds.has(m.id);
    const next = new Set(assigneeIds);
    if (on) next.add(m.id);
    else next.delete(m.id);
    setAssigneeIds(next);
    toggleCardAssignee(cardId, m.id, on);
    onPatch(cardId, { assignees: members.filter((x) => next.has(x.id)) });
  }

  function handleDelete() {
    if (!confirm("Delete this card?")) return;
    deleteCard(cardId);
    onDeleted(cardId);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-black/10 dark:border-white/15 bg-background shadow-xl">
        <div className="flex items-start justify-between gap-2 border-b border-black/10 dark:border-white/15 px-4 py-3">
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            rows={1}
            className="min-h-[2rem] flex-1 resize-none rounded bg-transparent px-1 text-base font-semibold outline-none hover:bg-black/[.04] focus:bg-black/[.04] dark:hover:bg-white/[.06]"
          />
          <button onClick={onClose} className="rounded px-2 py-1 text-foreground/60 hover:bg-black/[.06] dark:hover:bg-white/[.08]" title="Close">
            ✕
          </button>
        </div>

        {loading ? (
          <p className="p-4 text-sm text-foreground/50">Loading…</p>
        ) : (
          <div className="flex flex-col gap-6 p-4">
            <Section title="Due date">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dueDate ? dueDate.slice(0, 10) : ""}
                  onChange={(e) => changeDueDate(e.target.value)}
                  className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm outline-none"
                />
                {dueDate && (
                  <button onClick={() => changeDueDate("")} className="text-xs text-foreground/50 hover:underline">
                    Clear
                  </button>
                )}
              </div>
            </Section>

            <Section title="Labels">
              <div className="flex flex-wrap gap-1.5">
                {boardLabels.map((l) => {
                  const on = labelIds.has(l.id);
                  return (
                    <button
                      key={l.id}
                      onClick={() => toggleLabel(l)}
                      className={`rounded px-2 py-0.5 text-xs font-medium ${on ? "text-white" : "opacity-50"}`}
                      style={{ backgroundColor: l.color }}
                    >
                      {l.name}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <input
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addLabel()}
                  placeholder="New label…"
                  className="w-32 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-xs outline-none"
                />
                <div className="flex gap-1">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewLabelColor(c)}
                      className={`h-5 w-5 rounded-full ${newLabelColor === c ? "ring-2 ring-foreground ring-offset-1" : ""}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
                <button onClick={addLabel} className="rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background">
                  Add
                </button>
              </div>
            </Section>

            <Section title="Assignees">
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => {
                  const on = assigneeIds.has(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleAssignee(m)}
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        on
                          ? "border-foreground bg-foreground text-background"
                          : "border-black/15 dark:border-white/20 text-foreground/70"
                      }`}
                    >
                      {m.name ?? m.email}
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section title="Description">
              <DescriptionEditor key={cardId} initial={description} onSave={saveDescription} />
            </Section>

            <div className="border-t border-black/10 dark:border-white/15 pt-4">
              <button onClick={handleDelete} className="text-sm text-red-600 hover:underline">
                Delete card
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground/50">{title}</h3>
      {children}
    </section>
  );
}
