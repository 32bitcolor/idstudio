"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

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
  return (
    <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
      <Input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search cards…"
        className="h-8 w-44"
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

      <Select value={due} onChange={(e) => onDue(e.target.value as DueFilter)} className="h-8 w-auto py-1">
        <option value="any">Any due date</option>
        <option value="overdue">Overdue</option>
        <option value="week">Due this week</option>
        <option value="none">No due date</option>
      </Select>

      {active && (
        <>
          <Button variant="outline" size="sm" onClick={onClear}>Clear</Button>
          <span className="text-xs text-muted-foreground">
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
      <Button variant="outline" size="sm" onClick={() => !empty && setOpen((o) => !o)} disabled={empty}>
        {label}
        {count > 0 && <span className="rounded bg-accent px-1 text-xs text-accent-foreground">{count}</span>}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 max-h-60 w-56 overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg">
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
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-hover"
    >
      <span className="flex w-3 shrink-0 items-center text-foreground/70">{checked && <Check className="size-3.5" />}</span>
      {color && <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
      <span className="truncate">{text}</span>
    </button>
  );
}
