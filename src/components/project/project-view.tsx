"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  renameProject,
  setProjectStatus,
  updateProjectDescription,
  deleteProject,
  createPhase,
  renamePhase,
  setPhaseStatus,
  setPhaseDates,
  movePhase,
  deletePhase,
} from "@/app/actions/projects";
import {
  PHASE_STATUS_LABEL,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  type PhaseStatus,
  type ProjectStatus,
} from "@/lib/methodology";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { DeliverablesSection } from "@/components/project/deliverables-section";
import { MilestonesSection } from "@/components/project/milestones-section";
import { TimeTracking } from "@/components/project/time-tracking";

type Phase = {
  id: string;
  name: string;
  status: string;
  position: string;
  startDate: string | null;
  endDate: string | null;
};
type ProjectMeta = {
  id: string;
  name: string;
  description: string | null;
  methodology: string;
  status: string;
};

const NEXT_STATUS: Record<string, PhaseStatus> = {
  not_started: "in_progress",
  in_progress: "done",
  done: "not_started",
};

function statusClass(s: string) {
  if (s === "done") return "bg-green-500/15 text-green-600";
  if (s === "in_progress") return "bg-blue-500/15 text-blue-600";
  return "bg-muted text-foreground/60";
}

function move<T>(arr: T[], from: number, to: number) {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

type Member = { id: string; name: string | null; email: string };
type ReviewInit = {
  id: string;
  round: number;
  reviewerId: string;
  status: string;
  dueDate: string | null;
  feedback: string | null;
  reviewer: Member;
};
type DeliverableInit = {
  id: string;
  name: string;
  type: string;
  status: string;
  phaseId: string | null;
  card: { id: string; title: string; boardId: string; boardName: string } | null;
  storyboard: { id: string; title: string } | null;
  reviews: ReviewInit[];
};
type MilestoneInit = { id: string; name: string; dueDate: string | null; completedAt: string | null };
type TimeEntryInit = {
  id: string;
  minutes: number;
  note: string | null;
  loggedFor: string;
  user: Member;
  deliverable: { id: string; name: string } | null;
};

export function ProjectView({
  project,
  initialPhases,
  initialDeliverables,
  initialMilestones,
  initialTimeEntries,
  members,
}: {
  project: ProjectMeta;
  initialPhases: Phase[];
  initialDeliverables: DeliverableInit[];
  initialMilestones: MilestoneInit[];
  initialTimeEntries: TimeEntryInit[];
  members: Member[];
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [status, setStatus] = useState(project.status);
  const [phases, setPhases] = useState<Phase[]>(initialPhases);
  const [, startTransition] = useTransition();

  const done = phases.filter((p) => p.status === "done").length;

  function cycleStatus(p: Phase) {
    const next = NEXT_STATUS[p.status] ?? "not_started";
    setPhases((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: next } : x)));
    startTransition(() => void setPhaseStatus(p.id, next));
  }

  function renamePhaseLocal(id: string, value: string) {
    setPhases((prev) => prev.map((x) => (x.id === id ? { ...x, name: value } : x)));
  }

  function commitPhaseName(p: Phase, value: string) {
    // input is bound to the live phase name, so save whenever it's non-empty
    if (value.trim()) startTransition(() => void renamePhase(p.id, value.trim()));
  }

  function changeDate(p: Phase, which: "start" | "end", value: string) {
    const iso = value ? new Date(value).toISOString() : null;
    const startIso = which === "start" ? iso : p.startDate;
    const endIso = which === "end" ? iso : p.endDate;
    setPhases((prev) => prev.map((x) => (x.id === p.id ? { ...x, startDate: startIso, endDate: endIso } : x)));
    startTransition(() => void setPhaseDates(p.id, startIso, endIso));
  }

  function reorder(index: number, dir: -1 | 1) {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= phases.length) return;
    const next = move(phases, index, newIndex);
    setPhases(next);
    startTransition(() => void movePhase(phases[index].id, newIndex));
  }

  function removePhase(id: string) {
    if (!confirm("Delete this phase?")) return;
    setPhases((prev) => prev.filter((x) => x.id !== id));
    startTransition(() => void deletePhase(id));
  }

  async function addPhase(phaseName: string) {
    const res = await createPhase(project.id, phaseName);
    if ("phase" in res && res.phase) {
      setPhases((prev) => [...prev, { ...res.phase, startDate: null, endDate: null }]);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link href="/projects" className="text-sm text-foreground/60 hover:underline">
            ← Projects
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (name.trim() && name !== project.name) startTransition(() => void renameProject(project.id, name));
              }}
              className="min-w-0 flex-1 rounded bg-transparent text-2xl font-semibold tracking-tight outline-none hover:bg-hover focus:bg-hover"
            />
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground/70">{project.methodology}</span>
          </div>
        </div>
        <ThemeSwitcher />
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-foreground/60">Status</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              startTransition(() => void setProjectStatus(project.id, e.target.value));
            }}
            className="rounded-md border border-border-strong bg-transparent px-2 py-1 text-sm outline-none"
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABEL[s as ProjectStatus]}
              </option>
            ))}
          </select>
        </label>
        {phases.length > 0 && (
          <span className="text-sm text-foreground/50">
            {done}/{phases.length} phases done
          </span>
        )}
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => updateProjectDescription(project.id, description)}
        placeholder="Add a project description…"
        rows={2}
        className="mt-4 w-full resize-none rounded-md border border-border-strong bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/60"
      />

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">Phases</h2>
        <div className="mt-3 flex flex-col gap-2">
          {phases.length === 0 && (
            <p className="text-sm text-foreground/40">No phases yet. Add the first one below.</p>
          )}
          {phases.map((p, i) => (
            <div key={p.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
              <button
                onClick={() => cycleStatus(p)}
                className={`mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(p.status)}`}
                title="Click to advance status"
              >
                {PHASE_STATUS_LABEL[p.status as PhaseStatus] ?? p.status}
              </button>
              <div className="min-w-0 flex-1">
                <input
                  value={p.name}
                  onChange={(e) => renamePhaseLocal(p.id, e.target.value)}
                  onBlur={(e) => commitPhaseName(p, e.target.value)}
                  className="w-full rounded bg-transparent px-1 text-sm font-medium outline-none hover:bg-hover focus:bg-hover"
                />
                <div className="mt-1.5 flex flex-wrap items-center gap-3 px-1 text-xs text-foreground/60">
                  <label className="flex items-center gap-1">
                    Start
                    <input
                      type="date"
                      value={p.startDate ? p.startDate.slice(0, 10) : ""}
                      onChange={(e) => changeDate(p, "start", e.target.value)}
                      className="rounded border border-border-strong bg-transparent px-1 py-0.5"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    End
                    <input
                      type="date"
                      value={p.endDate ? p.endDate.slice(0, 10) : ""}
                      onChange={(e) => changeDate(p, "end", e.target.value)}
                      className="rounded border border-border-strong bg-transparent px-1 py-0.5"
                    />
                  </label>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-foreground/50">
                <button disabled={i === 0} onClick={() => reorder(i, -1)} className="rounded px-1 hover:bg-hover disabled:opacity-25" title="Move up">
                  ↑
                </button>
                <button disabled={i === phases.length - 1} onClick={() => reorder(i, 1)} className="rounded px-1 hover:bg-hover disabled:opacity-25" title="Move down">
                  ↓
                </button>
                <button onClick={() => removePhase(p.id)} className="rounded px-1 hover:bg-red-500/10 hover:text-red-600" title="Delete phase">
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
        <PhaseComposer onAdd={addPhase} />
      </section>

      <DeliverablesSection
        projectId={project.id}
        phases={phases.map((p) => ({ id: p.id, name: p.name }))}
        members={members}
        initial={initialDeliverables}
      />

      <MilestonesSection projectId={project.id} initial={initialMilestones} />

      <TimeTracking
        projectId={project.id}
        deliverables={initialDeliverables.map((d) => ({ id: d.id, name: d.name }))}
        initial={initialTimeEntries}
      />

      <div className="mt-10 border-t border-border pt-4">
        <form
          action={async () => {
            if (confirm("Delete this entire project?")) await deleteProject(project.id);
          }}
        >
          <button className="text-sm text-red-600 hover:underline">Delete project</button>
        </form>
      </div>
    </div>
  );
}

function PhaseComposer({ onAdd }: { onAdd: (name: string) => void }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 rounded-lg px-2 py-1.5 text-left text-sm text-foreground/50 hover:bg-hover">
        + Add a phase
      </button>
    );
  }

  function submit() {
    const v = value.trim();
    if (v) onAdd(v);
    setValue("");
    setOpen(false);
  }

  return (
    <div className="mt-2 flex gap-2">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") { setValue(""); setOpen(false); }
        }}
        placeholder="Phase name…"
        className="flex-1 rounded-md border border-border-strong bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/60"
      />
      <button onClick={submit} className="rounded-md bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
        Add
      </button>
      <button onClick={() => { setValue(""); setOpen(false); }} className="rounded-md px-2 py-1 text-sm text-foreground/60 hover:bg-hover">
        Cancel
      </button>
    </div>
  );
}
