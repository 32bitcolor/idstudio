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
import { SCREEN_TYPES, SCREEN_TYPE_LABEL, SCREEN_FIELDS, type ScreenType } from "@/lib/storyboard";
import { DescriptionEditor } from "@/components/board/description-editor";

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
};

function move<T>(arr: T[], from: number, to: number) {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function ScreensSection({ storyboardId, initial }: { storyboardId: string; initial: ScreenInit[] }) {
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
    if (!confirm("Delete this screen?")) return;
    setScreens((prev) => prev.filter((s) => s.id !== id));
    startTransition(() => void deleteScreen(id));
  }

  async function add(title: string) {
    const res = await createScreen(storyboardId, title);
    if ("screen" in res && res.screen) setScreens((prev) => [...prev, res.screen]);
  }

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">Screens</h2>
        {screens.length > 0 && <span className="text-xs text-foreground/40">{screens.length}</span>}
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {screens.length === 0 && <p className="text-sm text-foreground/40">No screens yet. Add the first one below.</p>}
        {screens.map((s, i) => (
          <ScreenCard
            key={s.id}
            screen={s}
            index={i}
            total={screens.length}
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
  onReorder,
  onRemove,
}: {
  screen: ScreenInit;
  index: number;
  total: number;
  onReorder: (index: number, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(screen.title);
  const [type, setType] = useState(screen.screenType);
  const [, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-border">
      <div className="flex items-center gap-2 p-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded px-1 text-foreground/40 hover:bg-hover"
          title={open ? "Collapse" : "Expand"}
        >
          {open ? "▾" : "▸"}
        </button>
        <span className="shrink-0 text-xs tabular-nums text-foreground/40">{index + 1}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title.trim() && title !== screen.title) startTransition(() => void renameScreen(screen.id, title));
          }}
          className="min-w-0 flex-1 rounded bg-transparent px-1 text-sm font-medium outline-none hover:bg-hover focus:bg-hover"
        />
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            startTransition(() => void setScreenType(screen.id, e.target.value));
          }}
          className="shrink-0 rounded-md border border-border-strong bg-transparent px-2 py-1 text-xs outline-none"
        >
          {SCREEN_TYPES.map((t) => (
            <option key={t} value={t}>
              {SCREEN_TYPE_LABEL[t as ScreenType]}
            </option>
          ))}
        </select>
        <div className="flex shrink-0 items-center gap-1 text-foreground/50">
          <button disabled={index === 0} onClick={() => onReorder(index, -1)} className="rounded px-1 hover:bg-hover disabled:opacity-25" title="Move up">
            ↑
          </button>
          <button disabled={index === total - 1} onClick={() => onReorder(index, 1)} className="rounded px-1 hover:bg-hover disabled:opacity-25" title="Move down">
            ↓
          </button>
          <button onClick={() => onRemove(screen.id)} className="rounded px-1 hover:bg-red-500/10 hover:text-red-600" title="Delete screen">
            ×
          </button>
        </div>
      </div>

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
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") { setValue(""); setOpen(false); }
        }}
        placeholder="Screen title…"
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
