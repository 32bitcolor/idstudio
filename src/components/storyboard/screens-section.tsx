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
import { AddRowButton, ListPanel, ROW_ACTIONS, SectionHeader } from "@/components/shared/page";
import { plainText } from "@/lib/review-snapshot";
import { cn } from "@/lib/utils";
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const allOpen = screens.length > 0 && screens.every((s) => expanded.has(s.id));

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
    if ("screen" in res && res.screen) {
      const screen = res.screen;
      setScreens((prev) => [...prev, { ...screen, objectiveIds: [] }]);
      // A new screen is empty — open it straight away so you can start writing.
      setExpanded((prev) => new Set(prev).add(screen.id));
    }
  }

  return (
    <section className="mt-8">
      <SectionHeader
        action={
          screens.length > 0 && (
            <span className="flex items-center gap-3 text-xs text-muted-foreground">
              {screens.length} screen{screens.length === 1 ? "" : "s"}
              <button
                type="button"
                onClick={() => setExpanded(allOpen ? new Set() : new Set(screens.map((s) => s.id)))}
                className="rounded px-1.5 py-0.5 font-medium text-foreground outline-none hover:bg-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {allOpen ? "Collapse all" : "Expand all"}
              </button>
            </span>
          )
        }
      >
        Screens
      </SectionHeader>

      {screens.length === 0 ? (
        <p className="text-sm text-muted-foreground">No screens yet. Add the first one below.</p>
      ) : (
        <ListPanel>
          {screens.map((s, i) => (
            <ScreenRow
              key={s.id}
              screen={s}
              index={i}
              total={screens.length}
              open={expanded.has(s.id)}
              onToggle={() => toggle(s.id)}
              objectives={projectObjectives}
              onReorder={reorder}
              onRemove={remove}
            />
          ))}
        </ListPanel>
      )}

      <ScreenComposer onAdd={add} />
    </section>
  );
}

function ScreenRow({
  screen,
  index,
  total,
  open,
  onToggle,
  objectives,
  onReorder,
  onRemove,
}: {
  screen: ScreenInit;
  index: number;
  total: number;
  open: boolean;
  onToggle: () => void;
  objectives: ProjectObjective[];
  onReorder: (index: number, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
}) {
  const [title, setTitle] = useState(screen.title);
  const [type, setType] = useState(screen.screenType);
  const [taught, setTaught] = useState<string[]>(screen.objectiveIds);
  // Kept current as fields save, so the collapsed preview never shows stale copy.
  const [copy, setCopy] = useState(() => ({
    onScreenText: plainText(screen.onScreenText),
    narration: plainText(screen.narration),
  }));
  const preview = copy.onScreenText || copy.narration;
  const [, startTransition] = useTransition();
  const bodyId = `screen-body-${screen.id}`;

  function toggleObjective(objectiveId: string) {
    const on = !taught.includes(objectiveId);
    setTaught((prev) => (on ? [...prev, objectiveId] : prev.filter((x) => x !== objectiveId)));
    startTransition(() => void toggleScreenObjective(screen.id, objectiveId, on));
  }

  return (
    <li className={cn("group", open && "bg-surface-muted/50")}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={`${open ? "Collapse" : "Expand"} screen ${index + 1}`}
          className="flex shrink-0 items-center gap-1.5 rounded px-0.5 text-muted-foreground outline-none hover:bg-hover hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} aria-hidden="true" />
          <span className="w-5 text-left text-xs tabular-nums">{index + 1}</span>
        </button>
        <div className="min-w-0 flex-1 basis-40">
          <InlineTitle
            value={title}
            onChange={setTitle}
            onCommit={() => {
              if (title.trim() && title !== screen.title) startTransition(() => void renameScreen(screen.id, title));
            }}
            ariaLabel="Screen title"
            className="text-sm font-medium tracking-normal"
          />
          {!open && preview && (
            <p className="truncate text-xs text-muted-foreground">{preview}</p>
          )}
        </div>
        {objectives.length > 0 && taught.length > 0 && (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
            title={`Teaches ${taught.length} objective${taught.length === 1 ? "" : "s"}`}
          >
            <Target className="size-3" aria-hidden="true" /> {taught.length}
            <span className="sr-only"> objective{taught.length === 1 ? "" : "s"}</span>
          </span>
        )}
        <Select
          value={type}
          aria-label="Screen type"
          onChange={(e) => {
            setType(e.target.value);
            startTransition(() => void setScreenType(screen.id, e.target.value));
          }}
          className="h-7 w-auto shrink-0 border-transparent bg-transparent py-0.5 text-xs text-muted-foreground shadow-none hover:border-border"
        >
          {SCREEN_TYPES.map((t) => (
            <option key={t} value={t}>
              {SCREEN_TYPE_LABEL[t as ScreenType]}
            </option>
          ))}
        </Select>
        <div className={ROW_ACTIONS}>
          <Button variant="ghost" size="icon-xs" disabled={index === 0} onClick={() => onReorder(index, -1)} title="Move up" aria-label="Move screen up">
            <ChevronUp className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" disabled={index === total - 1} onClick={() => onReorder(index, 1)} title="Move down" aria-label="Move screen down">
            <ChevronDown className="size-3.5" />
          </Button>
          <ConfirmDelete
            title="Delete this screen?"
            description="This permanently deletes the screen and its content."
            confirmLabel="Delete screen"
            onConfirm={() => onRemove(screen.id)}
            trigger={
              <Button variant="ghost" size="icon-xs" className="hover:bg-destructive/10 hover:text-destructive" title="Delete screen" aria-label="Delete screen">
                <X className="size-3.5" />
              </Button>
            }
          />
        </div>
      </div>

      {open && (
        <div id={bodyId} className="flex flex-col gap-4 px-3 pb-4 sm:pl-12">
          {objectives.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Target className="size-3.5" aria-hidden="true" /> Teaches
              </span>
              {objectives.map((o, i) => {
                const on = taught.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleObjective(o.id)}
                    title={o.text}
                    className={cn(
                      "h-6 rounded-full border px-2 text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      on ? "border-accent/40 bg-accent/10 text-foreground" : "border-dashed border-border-strong text-muted-foreground hover:bg-hover",
                    )}
                  >
                    O{i + 1}
                    <span className="sr-only">: {o.text}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            {SCREEN_FIELDS.map((f) => (
              <div key={f.key}>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{f.label}</p>
                <DescriptionEditor
                  initial={screen[f.key]}
                  editorClass="min-h-[64px] text-sm"
                  onSave={(json) => {
                    if (f.key === "onScreenText" || f.key === "narration") {
                      const key = f.key;
                      setCopy((prev) => ({ ...prev, [key]: plainText(json) }));
                    }
                    void updateScreenField(screen.id, f.key, json);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

function ScreenComposer({ onAdd }: { onAdd: (title: string) => void }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return <AddRowButton onClick={() => setOpen(true)}>Add a screen</AddRowButton>;
  }

  function submit() {
    const v = value.trim();
    if (v) onAdd(v);
    setValue("");
    setOpen(false);
  }

  return (
    <div className="mt-2 flex gap-2">
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
