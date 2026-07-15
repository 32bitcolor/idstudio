"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Columns3, ListChecks } from "lucide-react";
import { dueMeta, dueToneClass } from "@/lib/due";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";

type WorkloadCard = {
  id: string; title: string; dueDate: string | null;
  boardId: string; boardName: string; columnName: string;
};
type WorkloadSubtask = {
  id: string; text: string; dueDate: string | null;
  cardId: string; cardTitle: string; boardId: string; boardName: string;
};
export type MemberWorkload = {
  id: string; name: string | null; email: string; role: string;
  cards: WorkloadCard[]; subtasks: WorkloadSubtask[];
};

type DueFilter = "any" | "month" | "quarter" | "overdue" | "none";

function inBucket(dueDate: string | null, filter: DueFilter, today: string, monthEnd: string, quarterEnd: string) {
  if (filter === "any") return true;
  const ymd = dueDate ? dueDate.slice(0, 10) : null;
  if (filter === "none") return !ymd;
  if (!ymd) return false;
  if (filter === "overdue") return ymd < today;
  if (filter === "month") return ymd >= today && ymd <= monthEnd;
  if (filter === "quarter") return ymd >= today && ymd <= quarterEnd;
  return true;
}

export function WorkloadView({ workload }: { workload: MemberWorkload[] }) {
  const [due, setDue] = useState<DueFilter>("any");

  const { today, monthEnd, quarterEnd } = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const mEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const qEndMonth = Math.floor(now.getUTCMonth() / 3) * 3 + 3;
    const qEnd = new Date(Date.UTC(now.getUTCFullYear(), qEndMonth, 0));
    return { today, monthEnd: mEnd.toISOString().slice(0, 10), quarterEnd: qEnd.toISOString().slice(0, 10) };
  }, []);

  const filtered = useMemo(
    () =>
      workload.map((m) => ({
        ...m,
        cards: m.cards.filter((c) => inBucket(c.dueDate, due, today, monthEnd, quarterEnd)),
        subtasks: m.subtasks.filter((s) => inBucket(s.dueDate, due, today, monthEnd, quarterEnd)),
      })),
    [workload, due, today, monthEnd, quarterEnd],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="w-52">
        <Select aria-label="Filter by due date" value={due} onChange={(e) => setDue(e.target.value as DueFilter)}>
          <option value="any">All</option>
          <option value="month">This month</option>
          <option value="quarter">This quarter</option>
          <option value="overdue">Overdue</option>
          <option value="none">No due date</option>
        </Select>
      </div>

      <Card className="divide-y divide-border p-0">
        {filtered.map((m) => (
          <MemberRow key={m.id} member={m} />
        ))}
      </Card>
    </div>
  );
}

function MemberRow({ member }: { member: MemberWorkload }) {
  const items = [
    ...member.cards.map((c) => ({
      key: `card-${c.id}`,
      href: `/boards/${c.boardId}?card=${c.id}`,
      icon: Columns3,
      title: c.title,
      context: `${c.boardName} · ${c.columnName}`,
      dueDate: c.dueDate,
    })),
    ...member.subtasks.map((s) => ({
      key: `subtask-${s.id}`,
      href: `/boards/${s.boardId}?card=${s.cardId}`,
      icon: ListChecks,
      title: s.text,
      context: `${s.boardName} · ${s.cardTitle}`,
      dueDate: s.dueDate,
    })),
  ];

  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="flex items-center gap-2">
        <span className="font-medium">{member.name ?? member.email}</span>
        <span className="text-sm text-muted-foreground">{member.email}</span>
        <StatusBadge tone={member.role === "ADMIN" || member.role === "MANAGER" ? "info" : "neutral"} className="ml-auto">
          {member.role}
        </StatusBadge>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing in this window.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((item) => {
            const due = dueMeta(item.dueDate);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-hover"
              >
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <span className="truncate text-xs text-muted-foreground">{item.context}</span>
                {due && <span className={`shrink-0 text-xs ${dueToneClass[due.tone]}`}>{due.label}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
