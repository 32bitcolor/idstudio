"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

export type MentionMember = { id: string; name: string | null; email: string };
export type MentionListRef = { onKeyDown: (e: KeyboardEvent) => boolean };

/** The @-mention suggestion popup: an arrow-key/Enter navigable member list. */
export const MentionList = forwardRef<
  MentionListRef,
  { items: MentionMember[]; command: (item: { id: string; label: string }) => void }
>(function MentionList({ items, command }, ref) {
  const [selected, setSelected] = useState(0);
  useEffect(() => setSelected(0), [items]);

  function pick(i: number) {
    const m = items[i];
    if (m) command({ id: m.id, label: m.name ?? m.email });
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: (e) => {
      if (items.length === 0) return false;
      if (e.key === "ArrowUp") {
        setSelected((s) => (s + items.length - 1) % items.length);
        return true;
      }
      if (e.key === "ArrowDown") {
        setSelected((s) => (s + 1) % items.length);
        return true;
      }
      if (e.key === "Enter") {
        pick(selected);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) return null;
  return (
    <div className="max-h-56 w-56 overflow-y-auto rounded-md border border-border bg-surface py-1 text-sm shadow-lg">
      {items.map((m, i) => (
        <button
          key={m.id}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); pick(i); }}
          className={`flex w-full flex-col items-start px-3 py-1.5 text-left ${i === selected ? "bg-hover" : "hover:bg-hover"}`}
        >
          <span className="truncate font-medium">{m.name ?? m.email}</span>
          {m.name && <span className="truncate text-xs text-muted-foreground">{m.email}</span>}
        </button>
      ))}
    </div>
  );
});
