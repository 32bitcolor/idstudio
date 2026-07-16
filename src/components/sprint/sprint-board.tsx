"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { setCardStatus } from "@/app/actions/boards";
import { useSetPageTitle } from "@/components/app-shell/breadcrumbs";
import { Select } from "@/components/ui/select";
import { dueMeta, dueToneClass } from "@/lib/due";

type Person = { id: string; name: string | null; email: string };
type SprintCard = {
  id: string;
  title: string;
  keySeq: number | null;
  statusId: string | null;
  dueDate: string | null;
  boardId: string;
  cardKeyPrefix: string | null;
  project: { id: string; name: string } | null;
  assignees: Person[];
};
type StatusT = { id: string; name: string };

const NO_STATUS = "__none__";
const NO_PROJECT = "__noproject__";
const UNASSIGNED = "__unassigned__";

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
  useSetPageTitle(sprint.name);

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
      return true;
    });
  }, [cards, projectFilter, assigneeFilter]);

  // Status columns, plus a "No status" column only if some card needs it.
  const statusIds = new Set(statuses.map((s) => s.id));
  const needsNoStatus = visible.some((c) => !c.statusId || !statusIds.has(c.statusId));
  const columns = [
    ...statuses.map((s) => ({ id: s.id, name: s.name })),
    ...(needsNoStatus ? [{ id: NO_STATUS, name: "No status" }] : []),
  ];

  function cardsFor(statusId: string) {
    if (statusId === NO_STATUS) return visible.filter((c) => !c.statusId || !statusIds.has(c.statusId));
    return visible.filter((c) => c.statusId === statusId);
  }

  async function changeStatus(card: SprintCard, statusId: string) {
    const prev = card.statusId;
    setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, statusId } : c)));
    const res = await setCardStatus(card.id, statusId);
    if (res && "error" in res && res.error) {
      setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, statusId: prev } : c)));
    }
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
          <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="h-8 w-auto py-1 text-xs">
            <option value="">All projects</option>
            {projects.list.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
            {projects.hasNone && <option value={NO_PROJECT}>No project</option>}
          </Select>
          <Select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="h-8 w-auto py-1 text-xs">
            <option value="">All assignees</option>
            {people.list.map((p) => (
              <option key={p.id} value={p.id}>{p.name ?? p.email}</option>
            ))}
            {people.hasUnassigned && <option value={UNASSIGNED}>Unassigned</option>}
          </Select>
          <span className="text-xs text-muted-foreground">{visible.length} of {cards.length} cards</span>
        </div>
      </header>

      {cards.length === 0 && (
        <p className="mx-6 mb-3 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
          No cards assigned yet. Open any board, click a card, and set its{" "}
          <span className="font-medium text-foreground">Sprint</span> field to this sprint — it&rsquo;ll appear here.
        </p>
      )}
      {columns.length > 0 && (
        <div className="flex flex-1 gap-3 overflow-x-auto px-6 pb-6">
          {columns.map((col) => {
            const colCards = cardsFor(col.id);
            return (
              <div key={col.id} className="flex w-72 shrink-0 flex-col rounded-xl bg-muted/40 p-2">
                <div className="flex items-center justify-between px-1.5 py-1 text-sm font-medium">
                  <span>{col.name}</span>
                  <span className="text-xs text-muted-foreground">{colCards.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {colCards.map((c) => {
                    const due = c.dueDate ? dueMeta(c.dueDate) : null;
                    return (
                      <div key={c.id} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-sm">
                        <Link href={`/boards/${c.boardId}?card=${c.id}`} className="block hover:underline">
                          {c.cardKeyPrefix && c.keySeq != null && (
                            <span className="mr-1.5 font-mono text-xs font-medium text-muted-foreground">
                              {c.cardKeyPrefix}-{c.keySeq}
                            </span>
                          )}
                          {c.title}
                        </Link>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {c.project && (
                            <span className="truncate rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground" title={`Project: ${c.project.name}`}>
                              {c.project.name}
                            </span>
                          )}
                          {due && <span className={`text-[11px] ${dueToneClass[due.tone]}`}>{due.label}</span>}
                          {c.assignees.length > 0 && (
                            <span className="ml-auto flex -space-x-1.5">
                              {c.assignees.slice(0, 3).map((a) => (
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
                        <Select
                          value={statusIds.has(c.statusId ?? "") ? c.statusId! : ""}
                          onChange={(e) => e.target.value && changeStatus(c, e.target.value)}
                          className="mt-2 h-7 w-full py-0.5 text-xs"
                          aria-label="Card status"
                        >
                          {!statusIds.has(c.statusId ?? "") && <option value="">No status</option>}
                          {statuses.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </Select>
                      </div>
                    );
                  })}
                  {colCards.length === 0 && (
                    <p className="px-1.5 py-2 text-xs text-muted-foreground">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
