"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { listAssignableCards, assignCardToSprint } from "@/app/actions/sprints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { SprintCard } from "@/components/sprint/sprint-board";

export function AddCardsDialog({
  sprintId,
  onAdded,
}: {
  sprintId: string;
  onAdded: (card: SprintCard) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<SprintCard[]>([]);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    const res = await listAssignableCards(sprintId);
    setCards(res.cards);
    setLoading(false);
  }

  function onOpenChange(v: boolean) {
    setOpen(v);
    if (v) { setQuery(""); load(); }
  }

  async function add(card: SprintCard) {
    setAdding((s) => new Set(s).add(card.id));
    const res = await assignCardToSprint(card.id, sprintId);
    if (res && "error" in res && res.error) {
      setAdding((s) => { const n = new Set(s); n.delete(card.id); return n; });
      return;
    }
    setCards((cs) => cs.filter((c) => c.id !== card.id));
    onAdded(card);
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? cards.filter((c) => c.title.toLowerCase().includes(q) || (c.cardKeyPrefix && `${c.cardKeyPrefix}-${c.keySeq}`.toLowerCase().includes(q)))
    : cards;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button variant="outline" size="sm" onClick={() => onOpenChange(true)}>
        <Plus className="size-4" /> Add cards
      </Button>
      <DialogContent className="flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle>Add cards to this sprint</DialogTitle>
          <DialogDescription className="sr-only">Assign existing cards to the sprint</DialogDescription>
        </DialogHeader>
        <div className="border-b border-border p-3">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cards by title or key…"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="p-3 text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              {cards.length === 0 ? "No unassigned cards available." : "No cards match your search."}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {filtered.map((c) => (
                <li key={c.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-hover">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">
                      {c.cardKeyPrefix && c.keySeq != null && (
                        <span className="mr-1.5 font-mono text-xs font-medium text-muted-foreground">
                          {c.cardKeyPrefix}-{c.keySeq}
                        </span>
                      )}
                      {c.title}
                    </div>
                    {c.project && (
                      <div className="truncate text-xs text-muted-foreground">{c.project.name}</div>
                    )}
                  </div>
                  <Button size="xs" variant="secondary" disabled={adding.has(c.id)} onClick={() => add(c)}>
                    {adding.has(c.id) ? "Adding…" : "Add"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
