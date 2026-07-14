"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { createMilestone, toggleMilestone, setMilestoneDue, deleteMilestone } from "@/app/actions/deliverables";
import { SectionHeader } from "@/components/shared/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Milestone = { id: string; name: string; dueDate: string | null; completedAt: string | null };

function overdue(iso: string | null, completed: boolean) {
  if (!iso || completed) return false;
  return iso.slice(0, 10) < new Date().toISOString().slice(0, 10);
}

export function MilestonesSection({ projectId, initial }: { projectId: string; initial: Milestone[] }) {
  const [items, setItems] = useState<Milestone[]>(initial);
  const [, startTransition] = useTransition();

  function patch(id: string, p: Partial<Milestone>) {
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...p } : m)));
  }

  function toggle(m: Milestone) {
    const completed = !m.completedAt;
    patch(m.id, { completedAt: completed ? new Date().toISOString() : null });
    startTransition(() => void toggleMilestone(m.id, completed));
  }

  function changeDue(m: Milestone, value: string) {
    const iso = value ? new Date(value).toISOString() : null;
    patch(m.id, { dueDate: iso });
    startTransition(() => void setMilestoneDue(m.id, iso));
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((m) => m.id !== id));
    startTransition(() => void deleteMilestone(id));
  }

  async function add(name: string, dueIso: string | null) {
    const res = await createMilestone(projectId, name, dueIso);
    if ("milestone" in res && res.milestone) setItems((prev) => [...prev, res.milestone]);
  }

  return (
    <section className="mt-8">
      <SectionHeader>Milestones</SectionHeader>
      <div className="flex flex-col gap-1.5">
        {items.length === 0 && <p className="text-sm text-muted-foreground">No milestones yet.</p>}
        {items.map((m) => {
          const done = !!m.completedAt;
          return (
            <div key={m.id} className="group flex items-center gap-3 rounded-lg border border-border px-3 py-2">
              <input type="checkbox" checked={done} onChange={() => toggle(m)} className="h-4 w-4 shrink-0" />
              <span className={`flex-1 text-sm ${done ? "text-foreground/40 line-through" : ""}`}>{m.name}</span>
              <Input
                type="date"
                value={m.dueDate ? m.dueDate.slice(0, 10) : ""}
                onChange={(e) => changeDue(m, e.target.value)}
                className={cn("h-7 w-auto px-1.5 py-0.5 text-xs", overdue(m.dueDate, done) ? "text-destructive" : "text-muted-foreground")}
              />
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => remove(m.id)}
                className="shrink-0 text-foreground/30 opacity-0 hover:text-destructive group-hover:opacity-100"
                title="Delete milestone"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
      <MilestoneComposer onAdd={add} />
    </section>
  );
}

function MilestoneComposer({ onAdd }: { onAdd: (name: string, dueIso: string | null) => void }) {
  const [name, setName] = useState("");
  const [due, setDue] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 rounded-lg px-2 py-1.5 text-left text-sm text-foreground/50 hover:bg-hover">
        + Add a milestone
      </button>
    );
  }

  function submit() {
    if (name.trim()) onAdd(name.trim(), due ? new Date(due).toISOString() : null);
    setName("");
    setDue("");
    setOpen(false);
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setName(""); setOpen(false); } }}
        placeholder="Milestone name…"
        className="flex-1"
      />
      <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-auto" />
      <Button size="sm" onClick={submit}>Add</Button>
      <Button size="sm" variant="ghost" onClick={() => { setName(""); setOpen(false); }}>Cancel</Button>
    </div>
  );
}
