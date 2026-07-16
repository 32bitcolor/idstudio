"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Timer, X } from "lucide-react";

import {
  createSprint,
  renameSprint,
  setSprintStatus,
  setSprintDates,
  deleteSprint,
} from "@/app/actions/sprints";
import { SPRINT_STATUSES, SPRINT_STATUS_LABEL } from "@/lib/sprint";
import { InlineTitle } from "@/components/shared/inline-title";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type SprintT = {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  cardCount: number;
};

export function SprintsManager({ initial }: { initial: SprintT[] }) {
  const [sprints, setSprints] = useState<SprintT[]>(initial);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function patch(id: string, p: Partial<SprintT>) {
    setSprints((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s)));
  }

  async function add() {
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    setError(null);
    const res = await createSprint(trimmed, goal.trim() || undefined);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    if ("sprint" in res && res.sprint) {
      setSprints((prev) => [
        { ...res.sprint, startDate: null, endDate: null, cardCount: 0 },
        ...prev,
      ]);
      setName("");
      setGoal("");
    }
  }

  function remove(id: string) {
    setSprints((prev) => prev.filter((s) => s.id !== id));
    startTransition(() => void deleteSprint(id));
  }

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-end gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          maxLength={120}
          placeholder="New sprint name…"
          className="w-full sm:w-64"
        />
        <Input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          maxLength={500}
          placeholder="Goal (optional)"
          className="w-full sm:w-72"
        />
        <Button onClick={add} disabled={pending}>
          <Timer className="size-4" /> Create sprint
        </Button>
      </div>
      {error && <p role="alert" className="mt-1 text-sm text-destructive">{error}</p>}

      <div className="mt-6 flex flex-col gap-2">
        {sprints.length === 0 && (
          <p className="text-sm text-muted-foreground">No sprints yet.</p>
        )}
        {sprints.map((s) => (
          <div key={s.id} className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-2">
              <InlineTitle
                value={s.name}
                onChange={(v) => patch(s.id, { name: v })}
                onCommit={() => {
                  const v = s.name.trim();
                  if (v) startTransition(() => void renameSprint(s.id, v));
                }}
                ariaLabel="Sprint name"
                className="text-sm font-medium tracking-normal"
              />
              <span className="shrink-0 text-xs text-muted-foreground">
                {s.cardCount} {s.cardCount === 1 ? "card" : "cards"}
              </span>
              <Link
                href={`/sprints/${s.id}`}
                className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Open board <ArrowRight className="size-3" />
              </Link>
              <ConfirmDelete
                title="Delete this sprint?"
                description="The sprint is removed; its cards stay put and just lose the sprint tag."
                confirmLabel="Delete sprint"
                onConfirm={() => remove(s.id)}
                trigger={
                  <Button variant="ghost" size="icon-xs" className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete sprint">
                    <X className="size-3.5" />
                  </Button>
                }
              />
            </div>

            {s.goal && <p className="mt-1 text-sm text-muted-foreground">{s.goal}</p>}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Select
                value={s.status}
                onChange={(e) => {
                  patch(s.id, { status: e.target.value });
                  startTransition(() => void setSprintStatus(s.id, e.target.value));
                }}
                className="h-8 w-auto py-1 text-xs"
              >
                {SPRINT_STATUSES.map((st) => (
                  <option key={st} value={st}>{SPRINT_STATUS_LABEL[st]}</option>
                ))}
              </Select>
              <input
                type="date"
                value={s.startDate ?? ""}
                onChange={(e) => {
                  const v = e.target.value || null;
                  patch(s.id, { startDate: v });
                  startTransition(() => void setSprintDates(s.id, v, s.endDate));
                }}
                className="h-8 rounded-md border border-border bg-transparent px-2 text-xs"
                aria-label="Sprint start date"
              />
              <span className="text-xs text-muted-foreground">→</span>
              <input
                type="date"
                value={s.endDate ?? ""}
                onChange={(e) => {
                  const v = e.target.value || null;
                  patch(s.id, { endDate: v });
                  startTransition(() => void setSprintDates(s.id, s.startDate, v));
                }}
                className="h-8 rounded-md border border-border bg-transparent px-2 text-xs"
                aria-label="Sprint end date"
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
