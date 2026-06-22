"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  createDeliverable,
  renameDeliverable,
  setDeliverableType,
  setDeliverableStatus,
  setDeliverablePhase,
  linkDeliverableCard,
  deleteDeliverable,
  listLinkableCards,
} from "@/app/actions/deliverables";
import {
  DELIVERABLE_TYPES,
  DELIVERABLE_TYPE_LABEL,
  DELIVERABLE_STATUSES,
  DELIVERABLE_STATUS_LABEL,
  type DeliverableType,
  type DeliverableStatus,
} from "@/lib/methodology";

type CardLink = { id: string; title: string; boardId: string; boardName: string };
type Deliverable = {
  id: string;
  name: string;
  type: string;
  status: string;
  phaseId: string | null;
  card: CardLink | null;
};
type PhaseRef = { id: string; name: string };
type LinkableCard = { id: string; title: string; boardName: string };

const control = "rounded-md border border-border-strong bg-transparent px-2 py-1 text-xs outline-none";

export function DeliverablesSection({
  projectId,
  phases,
  initial,
}: {
  projectId: string;
  phases: PhaseRef[];
  initial: Deliverable[];
}) {
  const [items, setItems] = useState<Deliverable[]>(initial);
  const [linkable, setLinkable] = useState<LinkableCard[] | null>(null);
  const [, startTransition] = useTransition();

  async function ensureCards() {
    if (linkable) return;
    const res = await listLinkableCards(projectId);
    setLinkable(res.cards);
  }

  function patch(id: string, p: Partial<Deliverable>) {
    setItems((prev) => prev.map((d) => (d.id === id ? { ...d, ...p } : d)));
  }

  async function add(name: string, type: string) {
    const res = await createDeliverable(projectId, name, type);
    if ("deliverable" in res && res.deliverable) {
      const d = res.deliverable;
      setItems((prev) => [...prev, { id: d.id, name: d.name, type: d.type, status: d.status, phaseId: d.phaseId, card: null }]);
    }
  }

  async function link(d: Deliverable, cardId: string) {
    const res = await linkDeliverableCard(d.id, cardId || null);
    if ("card" in res) patch(d.id, { card: res.card });
  }

  function remove(id: string) {
    if (!confirm("Delete this deliverable?")) return;
    setItems((prev) => prev.filter((d) => d.id !== id));
    startTransition(() => void deleteDeliverable(id));
  }

  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">Deliverables</h2>
      <div className="mt-3 flex flex-col gap-2">
        {items.length === 0 && <p className="text-sm text-foreground/40">No deliverables yet.</p>}
        {items.map((d) => (
          <div key={d.id} className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-2">
              <input
                value={d.name}
                onChange={(e) => patch(d.id, { name: e.target.value })}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v) startTransition(() => void renameDeliverable(d.id, v));
                }}
                className="min-w-0 flex-1 rounded bg-transparent px-1 text-sm font-medium outline-none hover:bg-hover focus:bg-hover"
              />
              <button
                onClick={() => remove(d.id)}
                className="shrink-0 rounded px-1 text-foreground/40 hover:bg-red-500/10 hover:text-red-600"
                title="Delete deliverable"
              >
                ×
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={d.type}
                onChange={(e) => {
                  patch(d.id, { type: e.target.value });
                  startTransition(() => void setDeliverableType(d.id, e.target.value));
                }}
                className={control}
              >
                {DELIVERABLE_TYPES.map((t) => (
                  <option key={t} value={t}>{DELIVERABLE_TYPE_LABEL[t as DeliverableType]}</option>
                ))}
              </select>

              <select
                value={d.status}
                onChange={(e) => {
                  patch(d.id, { status: e.target.value });
                  startTransition(() => void setDeliverableStatus(d.id, e.target.value));
                }}
                className={control}
              >
                {DELIVERABLE_STATUSES.map((s) => (
                  <option key={s} value={s}>{DELIVERABLE_STATUS_LABEL[s as DeliverableStatus]}</option>
                ))}
              </select>

              <select
                value={d.phaseId ?? ""}
                onChange={(e) => {
                  const v = e.target.value || null;
                  patch(d.id, { phaseId: v });
                  startTransition(() => void setDeliverablePhase(d.id, v));
                }}
                className={control}
              >
                <option value="">No phase</option>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              {d.card ? (
                <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                  <Link href={`/boards/${d.card.boardId}`} className="hover:underline" title={`${d.card.boardName}: ${d.card.title}`}>
                    🔗 {d.card.title}
                  </Link>
                  <button onClick={() => link(d, "")} className="text-foreground/40 hover:text-red-600" title="Unlink">×</button>
                </span>
              ) : (
                <select
                  defaultValue=""
                  onFocus={ensureCards}
                  onChange={(e) => e.target.value && link(d, e.target.value)}
                  className={control}
                >
                  <option value="">{linkable ? "Link a card…" : "Link a card… (loading)"}</option>
                  {(linkable ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.boardName}: {c.title}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        ))}
      </div>
      <DeliverableComposer onAdd={add} />
    </section>
  );
}

function DeliverableComposer({ onAdd }: { onAdd: (name: string, type: string) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("course");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 rounded-lg px-2 py-1.5 text-left text-sm text-foreground/50 hover:bg-hover">
        + Add a deliverable
      </button>
    );
  }

  function submit() {
    if (name.trim()) onAdd(name.trim(), type);
    setName("");
    setOpen(false);
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setName(""); setOpen(false); } }}
        placeholder="Deliverable name…"
        className="flex-1 rounded-md border border-border-strong bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/60"
      />
      <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border border-border-strong bg-transparent px-2 py-1 text-sm">
        {DELIVERABLE_TYPES.map((t) => (
          <option key={t} value={t}>{DELIVERABLE_TYPE_LABEL[t as DeliverableType]}</option>
        ))}
      </select>
      <button onClick={submit} className="rounded-md bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">Add</button>
      <button onClick={() => { setName(""); setOpen(false); }} className="rounded-md px-2 py-1 text-sm text-foreground/60 hover:bg-hover">Cancel</button>
    </div>
  );
}
