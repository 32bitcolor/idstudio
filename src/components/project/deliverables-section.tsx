"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Link2, Film, MonitorPlay } from "lucide-react";
import { SectionHeader } from "@/components/shared/page";
import { InlineTitle } from "@/components/shared/inline-title";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
import { createStoryboardForDeliverable } from "@/app/actions/storyboards";
import { createCourseForDeliverable } from "@/app/actions/courses";
import {
  DELIVERABLE_TYPES,
  DELIVERABLE_TYPE_LABEL,
  DELIVERABLE_STATUSES,
  DELIVERABLE_STATUS_LABEL,
  type DeliverableType,
  type DeliverableStatus,
} from "@/lib/methodology";
import { ReviewCycles } from "@/components/project/review-cycles";

type Member = { id: string; name: string | null; email: string };
type Review = {
  id: string;
  round: number;
  reviewerId: string;
  status: string;
  dueDate: string | null;
  feedback: string | null;
  reviewer: Member;
};
type CardLink = { id: string; title: string; boardId: string; boardName: string };
type StoryboardLink = { id: string; title: string };
type CourseLink = { id: string; title: string };
type Deliverable = {
  id: string;
  name: string;
  type: string;
  status: string;
  phaseId: string | null;
  card: CardLink | null;
  storyboard: StoryboardLink | null;
  course: CourseLink | null;
  reviews: Review[];
};
type PhaseRef = { id: string; name: string };
type LinkableCard = { id: string; title: string; boardName: string };

export function DeliverablesSection({
  projectId,
  phases,
  members,
  initial,
}: {
  projectId: string;
  phases: PhaseRef[];
  members: Member[];
  initial: Deliverable[];
}) {
  const [items, setItems] = useState<Deliverable[]>(initial);
  const [linkable, setLinkable] = useState<LinkableCard[] | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

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
      setItems((prev) => [...prev, { id: d.id, name: d.name, type: d.type, status: d.status, phaseId: d.phaseId, card: null, storyboard: null, course: null, reviews: [] }]);
    }
  }

  async function link(d: Deliverable, cardId: string) {
    const res = await linkDeliverableCard(d.id, cardId || null);
    if ("card" in res) patch(d.id, { card: res.card });
  }

  async function openStoryboard(d: Deliverable) {
    if (d.storyboard) {
      router.push(`/storyboards/${d.storyboard.id}`);
      return;
    }
    const res = await createStoryboardForDeliverable(d.id);
    if ("storyboard" in res && res.storyboard) {
      patch(d.id, { storyboard: res.storyboard });
      router.push(`/storyboards/${res.storyboard.id}`);
    }
  }

  async function openCourse(d: Deliverable) {
    if (d.course) {
      router.push(`/courses/${d.course.id}`);
      return;
    }
    const res = await createCourseForDeliverable(d.id);
    if ("course" in res && res.course) {
      patch(d.id, { course: res.course });
      router.push(`/courses/${res.course.id}`);
    }
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((d) => d.id !== id));
    startTransition(() => void deleteDeliverable(id));
  }

  return (
    <section className="mt-8">
      <SectionHeader>Deliverables</SectionHeader>
      <div className="flex flex-col gap-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">No deliverables yet.</p>}
        {items.map((d) => (
          <div key={d.id} className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-2">
              <InlineTitle
                value={d.name}
                onChange={(v) => patch(d.id, { name: v })}
                onCommit={() => {
                  const v = d.name.trim();
                  if (v) startTransition(() => void renameDeliverable(d.id, v));
                }}
                ariaLabel="Deliverable name"
                className="text-sm font-medium tracking-normal"
              />
              <ConfirmDelete
                title="Delete this deliverable?"
                description="This permanently deletes the deliverable and its reviews."
                confirmLabel="Delete deliverable"
                onConfirm={() => remove(d.id)}
                trigger={
                  <Button variant="ghost" size="icon-xs" className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete deliverable">
                    <X className="size-3.5" />
                  </Button>
                }
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Select
                value={d.type}
                onChange={(e) => {
                  patch(d.id, { type: e.target.value });
                  startTransition(() => void setDeliverableType(d.id, e.target.value));
                }}
                className="h-8 w-auto py-1 text-xs"
              >
                {DELIVERABLE_TYPES.map((t) => (
                  <option key={t} value={t}>{DELIVERABLE_TYPE_LABEL[t as DeliverableType]}</option>
                ))}
              </Select>

              <Select
                value={d.status}
                onChange={(e) => {
                  patch(d.id, { status: e.target.value });
                  startTransition(() => void setDeliverableStatus(d.id, e.target.value));
                }}
                className="h-8 w-auto py-1 text-xs"
              >
                {DELIVERABLE_STATUSES.map((s) => (
                  <option key={s} value={s}>{DELIVERABLE_STATUS_LABEL[s as DeliverableStatus]}</option>
                ))}
              </Select>

              <Select
                value={d.phaseId ?? ""}
                onChange={(e) => {
                  const v = e.target.value || null;
                  patch(d.id, { phaseId: v });
                  startTransition(() => void setDeliverablePhase(d.id, v));
                }}
                className="h-8 w-auto py-1 text-xs"
              >
                <option value="">No phase</option>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>

              {d.card ? (
                <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                  <Link href={`/boards/${d.card.boardId}`} className="inline-flex items-center gap-1 hover:underline" title={`${d.card.boardName}: ${d.card.title}`}>
                    <Link2 className="size-3" /> {d.card.title}
                  </Link>
                  <button onClick={() => link(d, "")} className="text-foreground/40 hover:text-destructive" title="Unlink">
                    <X className="size-3" />
                  </button>
                </span>
              ) : (
                <Select
                  defaultValue=""
                  onFocus={ensureCards}
                  onChange={(e) => e.target.value && link(d, e.target.value)}
                  className="h-8 w-auto py-1 text-xs"
                >
                  <option value="">{linkable ? "Link a card…" : "Link a card… (loading)"}</option>
                  {(linkable ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.boardName}: {c.title}</option>
                  ))}
                </Select>
              )}

              {d.type === "storyboard" && (
                <Button variant="secondary" size="xs" onClick={() => openStoryboard(d)} title={d.storyboard ? "Open the linked storyboard" : "Create a storyboard for this deliverable"}>
                  <Film className="size-3" /> {d.storyboard ? "Open storyboard" : "Create storyboard"}
                </Button>
              )}

              {d.type === "course" && (
                <Button variant="secondary" size="xs" onClick={() => openCourse(d)} title={d.course ? "Open the linked course" : "Create a course for this deliverable"}>
                  <MonitorPlay className="size-3" /> {d.course ? "Open course" : "Create course"}
                </Button>
              )}
            </div>

            <ReviewCycles deliverableId={d.id} members={members} initial={d.reviews} />
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
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setName(""); setOpen(false); } }}
        placeholder="Deliverable name…"
        className="flex-1"
      />
      <Select value={type} onChange={(e) => setType(e.target.value)} className="w-auto">
        {DELIVERABLE_TYPES.map((t) => (
          <option key={t} value={t}>{DELIVERABLE_TYPE_LABEL[t as DeliverableType]}</option>
        ))}
      </Select>
      <Button size="sm" onClick={submit}>Add</Button>
      <Button size="sm" variant="ghost" onClick={() => { setName(""); setOpen(false); }}>Cancel</Button>
    </div>
  );
}
