"use client";

import { useState, useTransition } from "react";
import {
  createScreen,
  renameScreen,
  setScreenType,
  updateScreenField,
  moveScreen,
  deleteScreen,
} from "@/app/actions/storyboards";
import { toggleScreenObjective } from "@/app/actions/objectives";
import { SCREEN_TYPES, SCREEN_TYPE_LABEL, SCREEN_FIELDS, type ScreenType } from "@/lib/storyboard";
import { DescriptionEditor } from "@/components/board/description-editor";
import { Target, ChevronDown, ChevronRight, ChevronUp, X } from "lucide-react";
import { SectionHeader } from "@/components/shared/page";
import { InlineTitle } from "@/components/shared/inline-title";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export type ProjectObjective = { id: string; text: string };

export type ScreenInit = {
  id: string;
  title: string;
  screenType: string;
  position: string;
  onScreenText: string | null;
  narration: string | null;
  visualNotes: string | null;
  interactionNotes: string | null;
  developerNotes: string | null;
  objectiveIds: string[];
};

function move<T>(arr: T[], from: number, to: number) {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function ScreensSection({
  storyboardId,
  initial,
  projectObjectives = [],
}: {
  storyboardId: string;
  initial: ScreenInit[];
  projectObjectives?: ProjectObjective[];
}) {
  const [screens, setScreens] = useState<ScreenInit[]>(initial);
  const [, startTransition] = useTransition();

  function reorder(index: number, dir: -1 | 1) {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= screens.length) return;
    const id = screens[index].id;
    setScreens(move(screens, index, newIndex));
    startTransition(() => void moveScreen(id, newIndex));
  }

  function remove(id: string) {
    setScreens((prev) => prev.filter((s) => s.id !== id));
    startTransition(() => void deleteScreen(id));
  }

  async function add(title: string) {
    const res = await createScreen(storyboardId, title);
    if ("screen" in res && res.screen) setScreens((prev) => [...prev, { ...res.screen, objectiveIds: [] }]);
  }

  return (
    <section className="mt-8">
      <SectionHeader action={screens.length > 0 && <span className="text-xs text-muted-foreground">{screens.length}</span>}>
        Screens
      </SectionHeader>

      <div className="flex flex-col gap-3">
        {screens.length === 0 && <p className="text-sm text-foreground/40">No screens yet. Add the first one below.</p>}
        {screens.map((s, i) => (
          <ScreenCard
            key={s.id}
            screen={s}
            index={i}
            total={screens.length}
            objectives={projectObjectives}
            onReorder={reorder}
            onRemove={remove}
          />
        ))}
      </div>

      <ScreenComposer onAdd={add} />
    </section>
  );
}

function ScreenCard({
  screen,
  index,
  total,
  objectives,
  onReorder,
  onRemove,
}: {
  screen: ScreenInit;
  index: number;
  total: number;
  objectives: ProjectObjective[];
  onReorder: (index: number, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(screen.title);
  const [type, setType] = useState(screen.screenType);
  const [taught, setTaught] = useState<string[]>(screen.objectiveIds);
  const [, startTransition] = useTransition();

  function toggleObjective(objectiveId: string) {
    const on = !taught.includes(objectiveId);
    setTaught((prev) => (on ? [...prev, objectiveId] : prev.filter((x) => x !== objectiveId)));
    startTransition(() => void toggleScreenObjective(screen.id, objectiveId, on));
  }

  return (
    <div className="rounded-xl border border-border">
      <div className="flex items-center gap-2 p-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-hover"
          title={open ? "Collapse" : "Expand"}
        >
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <span className="shrink-0 text-xs tabular-nums text-foreground/40">{index + 1}</span>
        <InlineTitle
          value={title}
          onChange={setTitle}
          onCommit={() => {
            if (title.trim() && title !== screen.title) startTransition(() => void renameScreen(screen.id, title));
          }}
          ariaLabel="Screen title"
          className="text-sm font-medium tracking-normal"
        />
        <Select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            startTransition(() => void setScreenType(screen.id, e.target.value));
          }}
          className="w-auto shrink-0 py-1 text-xs"
        >
          {SCREEN_TYPES.map((t) => (
            <option key={t} value={t}>
              {SCREEN_TYPE_LABEL[t as ScreenType]}
            </option>
          ))}
        </Select>
        {objectives.length > 0 && taught.length > 0 && (
          <span
            className="hidden shrink-0 items-center gap-1 rounded-md bg-accent/12 px-1.5 py-0.5 text-xs font-medium text-accent sm:inline-flex"
            title={`Teaches ${taught.length} objective${taught.length === 1 ? "" : "s"}`}
          >
            <Target className="size-3" /> {taught.length}
          </span>
        )}
        <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
          <Button variant="ghost" size="icon-xs" disabled={index === 0} onClick={() => onReorder(index, -1)} title="Move up">
            <ChevronUp className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" disabled={index === total - 1} onClick={() => onReorder(index, 1)} title="Move down">
            <ChevronDown className="size-3.5" />
          </Button>
          <ConfirmDelete
            title="Delete this screen?"
            description="This permanently deletes the screen and its content."
            confirmLabel="Delete screen"
            onConfirm={() => onRemove(screen.id)}
            trigger={
              <Button variant="ghost" size="icon-xs" className="hover:bg-destructive/10 hover:text-destructive" title="Delete screen">
                <X className="size-3.5" />
              </Button>
            }
          />
        </div>
      </div>

      {open && objectives.length > 0 && (
        <div className="border-t border-border px-3 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground/60">
              <Target className="size-3.5" /> Teaches:
            </span>
            {objectives.map((o, i) => {
              const on = taught.includes(o.id);
              return (
                <button
                  key={o.id}
                  onClick={() => toggleObjective(o.id)}
                  title={o.text}
                  className={
                    "rounded-md px-2 py-0.5 text-xs font-medium transition-colors " +
                    (on ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-hover")
                  }
                >
                  O{i + 1}
                </button>
              );
            })}
            <span className="text-xs text-foreground/40">
              (hover a chip for the full objective)
            </span>
          </div>
        </div>
      )}

      {open && (
        <div className="grid gap-4 border-t border-border px-3 py-3 sm:grid-cols-2">
          {SCREEN_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs font-medium text-foreground/60">{f.label}</label>
              <DescriptionEditor
                initial={screen[f.key]}
                editorClass="min-h-[64px] text-sm"
                onSave={(json) => void updateScreenField(screen.id, f.key, json)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScreenComposer({ onAdd }: { onAdd: (title: string) => void }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-3 rounded-lg px-2 py-1.5 text-left text-sm text-foreground/50 hover:bg-hover">
        + Add a screen
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
    <div className="mt-3 flex gap-2">
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") { setValue(""); setOpen(false); }
        }}
        placeholder="Screen title…"
        className="flex-1"
      />
      <Button size="sm" onClick={submit}>Add</Button>
      <Button size="sm" variant="ghost" onClick={() => { setValue(""); setOpen(false); }}>Cancel</Button>
    </div>
  );
}
