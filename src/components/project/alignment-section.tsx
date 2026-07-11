"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ChevronUp, ChevronDown, X, Target, Plus } from "lucide-react";

import {
  createObjective,
  setObjectiveText,
  setObjectiveBloom,
  moveObjective,
  deleteObjective,
  createAssessmentItem,
  setAssessmentItemPrompt,
  setAssessmentItemType,
  deleteAssessmentItem,
  toggleItemObjective,
} from "@/app/actions/objectives";
import {
  BLOOM_LEVELS,
  BLOOM_LABEL,
  BLOOM_VERBS,
  ASSESSMENT_ITEM_TYPES,
  ASSESSMENT_ITEM_TYPE_LABEL,
  type BloomLevel,
  type AssessmentItemType,
} from "@/lib/methodology";
import { SectionHeader } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";

export type ObjectiveInit = {
  id: string;
  text: string;
  bloomLevel: string;
  position: string;
  screenCount: number;
};
export type AssessmentInit = {
  id: string;
  prompt: string;
  itemType: string;
  position: string;
  objectiveIds: string[];
};
type Coverage = { totalScreens: number; orphanScreens: number };

const control = "rounded-md border border-border-strong bg-transparent px-2 py-1 text-xs outline-none";

function move<T>(arr: T[], from: number, to: number) {
  const next = arr.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

export function AlignmentSection({
  projectId,
  initialObjectives,
  initialAssessments,
  coverage,
}: {
  projectId: string;
  initialObjectives: ObjectiveInit[];
  initialAssessments: AssessmentInit[];
  coverage: Coverage;
}) {
  const [objectives, setObjectives] = useState<ObjectiveInit[]>(initialObjectives);
  const [items, setItems] = useState<AssessmentInit[]>(initialAssessments);
  const [, startTransition] = useTransition();

  // "Assessed" counts derive from the items state so they update live as you link.
  const assessedCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) for (const oid of it.objectiveIds) m.set(oid, (m.get(oid) ?? 0) + 1);
    return m;
  }, [items]);

  const untaught = objectives.filter((o) => o.screenCount === 0).length;
  const unassessed = objectives.filter((o) => (assessedCount.get(o.id) ?? 0) === 0).length;

  // ── objective ops ──
  function patchObj(id: string, p: Partial<ObjectiveInit>) {
    setObjectives((prev) => prev.map((o) => (o.id === id ? { ...o, ...p } : o)));
  }
  async function addObjective(text: string, bloom: string) {
    const res = await createObjective(projectId, text, bloom);
    if ("objective" in res && res.objective) {
      setObjectives((prev) => [...prev, { ...res.objective, screenCount: 0 }]);
    }
  }
  function reorderObj(index: number, dir: -1 | 1) {
    const to = index + dir;
    if (to < 0 || to >= objectives.length) return;
    setObjectives((prev) => move(prev, index, to));
    startTransition(() => void moveObjective(objectives[index].id, to));
  }
  function removeObjective(id: string) {
    if (!confirm("Delete this objective? Its screen and assessment links go too.")) return;
    setObjectives((prev) => prev.filter((o) => o.id !== id));
    setItems((prev) => prev.map((it) => ({ ...it, objectiveIds: it.objectiveIds.filter((x) => x !== id) })));
    startTransition(() => void deleteObjective(id));
  }

  // ── assessment ops ──
  function patchItem(id: string, p: Partial<AssessmentInit>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));
  }
  async function addItem(prompt: string, type: string) {
    const res = await createAssessmentItem(projectId, prompt, type);
    if ("item" in res && res.item) {
      setItems((prev) => [...prev, { ...res.item, objectiveIds: [] }]);
    }
  }
  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
    startTransition(() => void deleteAssessmentItem(id));
  }
  function toggleLink(item: AssessmentInit, objectiveId: string) {
    const on = !item.objectiveIds.includes(objectiveId);
    patchItem(item.id, {
      objectiveIds: on
        ? [...item.objectiveIds, objectiveId]
        : item.objectiveIds.filter((x) => x !== objectiveId),
    });
    startTransition(() => void toggleItemObjective(item.id, objectiveId, on));
  }

  const shortLabel = (o: ObjectiveInit, i: number) => `O${i + 1}`;

  return (
    <section className="mt-8">
      <SectionHeader
        action={
          <Link
            href="/help/objectives-alignment"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            How this works →
          </Link>
        }
      >
        Learning objectives &amp; alignment
      </SectionHeader>

      {objectives.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <StatusBadge tone="neutral">{objectives.length} objectives</StatusBadge>
          <StatusBadge tone={untaught ? "warning" : "success"}>
            {untaught ? `${untaught} not yet taught` : "all taught"}
          </StatusBadge>
          <StatusBadge tone={unassessed ? "warning" : "success"}>
            {unassessed ? `${unassessed} not yet assessed` : "all assessed"}
          </StatusBadge>
          {coverage.orphanScreens > 0 && (
            <StatusBadge tone="warning">
              {coverage.orphanScreens} of {coverage.totalScreens} screens teach no objective
            </StatusBadge>
          )}
        </div>
      )}

      {/* Objectives + coverage */}
      <div className="flex flex-col gap-2">
        {objectives.length === 0 && (
          <p className="text-sm text-foreground/40">
            No objectives yet. Start with what a learner should be able to <em>do</em> after this.
          </p>
        )}
        {objectives.map((o, i) => {
          const taught = o.screenCount;
          const assessed = assessedCount.get(o.id) ?? 0;
          return (
            <div key={o.id} className="rounded-xl border border-border p-3">
              <div className="flex items-start gap-2">
                <span className="mt-1 shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  {shortLabel(o, i)}
                </span>
                <div className="flex shrink-0 flex-col">
                  <button
                    onClick={() => reorderObj(i, -1)}
                    disabled={i === 0}
                    className="text-foreground/40 hover:text-foreground disabled:opacity-25"
                    title="Move up"
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    onClick={() => reorderObj(i, 1)}
                    disabled={i === objectives.length - 1}
                    className="text-foreground/40 hover:text-foreground disabled:opacity-25"
                    title="Move down"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                </div>
                <textarea
                  value={o.text}
                  onChange={(e) => patchObj(o.id, { text: e.target.value })}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== initialObjectives.find((x) => x.id === o.id)?.text) {
                      startTransition(() => void setObjectiveText(o.id, v));
                    }
                  }}
                  rows={2}
                  className="min-w-0 flex-1 resize-none rounded bg-transparent px-1 text-sm outline-none hover:bg-hover focus:bg-hover"
                />
                <button
                  onClick={() => removeObjective(o.id)}
                  className="shrink-0 rounded px-1 text-foreground/40 hover:bg-destructive/10 hover:text-destructive"
                  title="Delete objective"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 pl-8">
                <select
                  value={o.bloomLevel}
                  onChange={(e) => {
                    patchObj(o.id, { bloomLevel: e.target.value });
                    startTransition(() => void setObjectiveBloom(o.id, e.target.value));
                  }}
                  className={control}
                  title="Bloom's cognitive level"
                >
                  {BLOOM_LEVELS.map((b) => (
                    <option key={b} value={b}>{BLOOM_LABEL[b as BloomLevel]}</option>
                  ))}
                </select>
                <StatusBadge tone={taught ? "success" : "warning"}>
                  {taught ? `Taught · ${taught} screen${taught === 1 ? "" : "s"}` : "Not yet taught"}
                </StatusBadge>
                <StatusBadge tone={assessed ? "success" : "warning"}>
                  {assessed ? `Assessed · ${assessed} item${assessed === 1 ? "" : "s"}` : "Not yet assessed"}
                </StatusBadge>
              </div>
            </div>
          );
        })}
      </div>
      <ObjectiveComposer onAdd={addObjective} />

      {/* Assessment items */}
      <div className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Assessment items
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Questions and checks that measure the objectives — the assessment half of the alignment
          spine (not a full exam engine).
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {items.length === 0 && (
            <p className="text-sm text-foreground/40">No assessment items yet.</p>
          )}
          {items.map((it) => (
            <div key={it.id} className="rounded-xl border border-border p-3">
              <div className="flex items-start gap-2">
                <textarea
                  value={it.prompt}
                  onChange={(e) => patchItem(it.id, { prompt: e.target.value })}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== initialAssessments.find((x) => x.id === it.id)?.prompt) {
                      startTransition(() => void setAssessmentItemPrompt(it.id, v));
                    }
                  }}
                  rows={2}
                  className="min-w-0 flex-1 resize-none rounded bg-transparent px-1 text-sm outline-none hover:bg-hover focus:bg-hover"
                />
                <button
                  onClick={() => removeItem(it.id)}
                  className="shrink-0 rounded px-1 text-foreground/40 hover:bg-destructive/10 hover:text-destructive"
                  title="Delete item"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={it.itemType}
                  onChange={(e) => {
                    patchItem(it.id, { itemType: e.target.value });
                    startTransition(() => void setAssessmentItemType(it.id, e.target.value));
                  }}
                  className={control}
                >
                  {ASSESSMENT_ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>{ASSESSMENT_ITEM_TYPE_LABEL[t as AssessmentItemType]}</option>
                  ))}
                </select>
                {objectives.length === 0 ? (
                  <span className="text-xs text-foreground/40">Add objectives to link this to.</span>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Target className="size-3" /> Assesses:
                    </span>
                    {objectives.map((o, i) => {
                      const on = it.objectiveIds.includes(o.id);
                      return (
                        <button
                          key={o.id}
                          onClick={() => toggleLink(it, o.id)}
                          title={o.text}
                          className={
                            "rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors " +
                            (on
                              ? "bg-accent text-accent-foreground"
                              : "bg-muted text-muted-foreground hover:bg-hover")
                          }
                        >
                          {shortLabel(o, i)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <ItemComposer onAdd={addItem} />
      </div>
    </section>
  );
}

function ObjectiveComposer({ onAdd }: { onAdd: (text: string, bloom: string) => void }) {
  const [text, setText] = useState("");
  const [bloom, setBloom] = useState<string>("apply");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 rounded-lg px-2 py-1.5 text-left text-sm text-foreground/50 hover:bg-hover"
      >
        <Plus className="mr-1 inline size-3.5" /> Add an objective
      </button>
    );
  }
  function submit() {
    if (text.trim()) onAdd(text.trim(), bloom);
    setText("");
    setOpen(false);
  }
  return (
    <div className="mt-2 rounded-xl border border-border-strong p-3">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          if (e.key === "Escape") { setText(""); setOpen(false); }
        }}
        rows={2}
        placeholder="After this, the learner will be able to…"
        className="w-full resize-none rounded-md bg-transparent px-1 text-sm outline-none"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select value={bloom} onChange={(e) => setBloom(e.target.value)} className={control}>
          {BLOOM_LEVELS.map((b) => (
            <option key={b} value={b}>{BLOOM_LABEL[b as BloomLevel]}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          Try: {BLOOM_VERBS[bloom as BloomLevel].slice(0, 4).join(", ")}…
        </span>
        <div className="ml-auto flex gap-2">
          <button onClick={submit} className="rounded-md bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
            Add
          </button>
          <button onClick={() => { setText(""); setOpen(false); }} className="rounded-md px-2 py-1 text-sm text-foreground/60 hover:bg-hover">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemComposer({ onAdd }: { onAdd: (prompt: string, type: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState<string>("multiple_choice");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 rounded-lg px-2 py-1.5 text-left text-sm text-foreground/50 hover:bg-hover"
      >
        <Plus className="mr-1 inline size-3.5" /> Add an assessment item
      </button>
    );
  }
  function submit() {
    if (prompt.trim()) onAdd(prompt.trim(), type);
    setPrompt("");
    setOpen(false);
  }
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <input
        autoFocus
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setPrompt(""); setOpen(false); } }}
        placeholder="Question or check…"
        className="flex-1 rounded-md border border-border-strong bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/60"
      />
      <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border border-border-strong bg-transparent px-2 py-1 text-sm">
        {ASSESSMENT_ITEM_TYPES.map((t) => (
          <option key={t} value={t}>{ASSESSMENT_ITEM_TYPE_LABEL[t as AssessmentItemType]}</option>
        ))}
      </select>
      <button onClick={submit} className="rounded-md bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">Add</button>
      <button onClick={() => { setPrompt(""); setOpen(false); }} className="rounded-md px-2 py-1 text-sm text-foreground/60 hover:bg-hover">Cancel</button>
    </div>
  );
}
