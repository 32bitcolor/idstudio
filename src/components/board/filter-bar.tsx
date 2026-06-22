"use client";

import { useState } from "react";

type Label = { id: string; name: string; color: string };
type Member = { id: string; name: string | null; email: string };
export type DueFilter = "any" | "overdue" | "week" | "none";

export function FilterBar({
  labels,
  members,
  selectedLabels,
  onToggleLabel,
  selectedAssignees,
  onToggleAssignee,
  due,
  onDue,
  search,
  onSearch,
  active,
  onClear,
  visible,
  total,
}: {
  labels: Label[];
  members: Member[];
  selectedLabels: Set<string>;
  onToggleLabel: (id: string) => void;
  selectedAssignees: Set<string>;
  onToggleAssignee: (id: string) => void;
  due: DueFilter;
  onDue: (d: DueFilter) => void;
  search: string;
  onSearch: (s: string) => void;
  active: boolean;
  onClear: () => void;
  visible: number;
  total: number;
}) {
  const input =
    "rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm outline-none focus:border-foreground/60";

  return (
    <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search cards…"
        className={`w-44 ${input}`}
      />

      <Dropdown label="Labels" count={selectedLabels.size} empty={labels.length === 0}>
        {labels.map((l) => (
          <CheckRow
            key={l.id}
            checked={selectedLabels.has(l.id)}
            onClick={() => onToggleLabel(l.id)}
            text={l.name}
            color={l.color}
          />
        ))}
      </Dropdown>

      <Dropdown label="Assignees" count={selectedAssignees.size} empty={members.length === 0}>
        {members.map((m) => (
          <CheckRow
            key={m.id}
            checked={selectedAssignees.has(m.id)}
            onClick={() => onToggleAssignee(m.id)}
            text={m.name ?? m.email}
          />
        ))}
      </Dropdown>

      <select value={due} onChange={(e) => onDue(e.target.value as DueFilter)} className={input}>
        <option value="any">Any due date</option>
        <option value="overdue">Overdue</option>
        <option value="week">Due this week</option>
        <option value="none">No due date</option>
      </select>

      {active && (
        <>
          <button
            onClick={onClear}
            className="rounded-md border border-black/15 dark:border-white/20 px-2 py-1 text-sm text-foreground/70 hover:bg-black/[.04] dark:hover:bg-white/[.06]"
          >
            Clear
          </button>
          <span className="text-xs text-foreground/50">
            {visible}/{total} cards · drag disabled
          </span>
        </>
      )}
    </div>
  );
}

function Dropdown({
  label,
  count,
  empty,
  children,
}: {
  label: string;
  count: number;
  empty: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => !empty && setOpen((o) => !o)}
        disabled={empty}
        className="rounded-md border border-black/15 dark:border-white/20 px-2 py-1 text-sm text-foreground/70 hover:bg-black/[.04] disabled:opacity-40 dark:hover:bg-white/[.06]"
      >
        {label}
        {count > 0 && <span className="ml-1 rounded bg-foreground px-1 text-xs text-background">{count}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 max-h-60 w-56 overflow-y-auto rounded-md border border-black/10 dark:border-white/15 bg-background py-1 shadow-lg">
            {children}
          </div>
        </>
      )}
    </div>
  );
}

function CheckRow({
  checked,
  onClick,
  text,
  color,
}: {
  checked: boolean;
  onClick: () => void;
  text: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-black/[.04] dark:hover:bg-white/[.06]"
    >
      <span className="w-3 shrink-0 text-foreground/70">{checked ? "✓" : ""}</span>
      {color && <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
      <span className="truncate">{text}</span>
    </button>
  );
}
