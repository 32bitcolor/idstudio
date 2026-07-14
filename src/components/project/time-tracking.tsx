"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { addTimeEntry, deleteTimeEntry } from "@/app/actions/time";
import { SectionHeader } from "@/components/shared/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Member = { id: string; name: string | null; email: string };
type DeliverableRef = { id: string; name: string };
type Entry = {
  id: string;
  minutes: number;
  note: string | null;
  loggedFor: string;
  user: Member;
  deliverable: DeliverableRef | null;
};

function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}
function fmtHours(mins: number) {
  return (mins / 60).toFixed(2).replace(/\.?0+$/, "");
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

export function TimeTracking({
  projectId,
  deliverables,
  initial,
}: {
  projectId: string;
  deliverables: DeliverableRef[];
  initial: Entry[];
}) {
  const [entries, setEntries] = useState<Entry[]>(initial);
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState("");
  const [deliverableId, setDeliverableId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [, startTransition] = useTransition();

  const total = entries.reduce((n, e) => n + e.minutes, 0);

  async function add() {
    const hrs = parseFloat(hours);
    if (!Number.isFinite(hrs) || hrs <= 0) return;
    const minutes = Math.round(hrs * 60);
    const iso = date ? new Date(date).toISOString() : new Date().toISOString();
    const res = await addTimeEntry(projectId, deliverableId || null, minutes, iso, note);
    if ("entry" in res && res.entry) {
      setEntries((prev) => [res.entry, ...prev]);
      setHours("");
      setNote("");
      setOpen(false);
    }
  }

  function remove(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    startTransition(() => void deleteTimeEntry(id));
  }

  return (
    <section className="mt-8">
      <SectionHeader action={total > 0 && <span className="text-sm text-muted-foreground">{fmtHours(total)}h total</span>}>
        Time tracking
      </SectionHeader>

      <div className="flex flex-col gap-1.5">
        {entries.length === 0 && <p className="text-sm text-muted-foreground">No time logged yet.</p>}
        {entries.map((e) => (
          <div key={e.id} className="group flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
            <span className="w-14 shrink-0 text-foreground/50">{fmtDate(e.loggedFor)}</span>
            <span className="w-16 shrink-0 font-medium">{fmtDuration(e.minutes)}</span>
            <span className="shrink-0 text-foreground/60">{e.user.name ?? e.user.email}</span>
            {e.deliverable && <span className="truncate rounded bg-muted px-1.5 py-0.5 text-xs text-foreground/70">{e.deliverable.name}</span>}
            <span className="flex-1 truncate text-foreground/60">{e.note}</span>
            <Button variant="ghost" size="icon-xs" onClick={() => remove(e.id)} className="shrink-0 text-foreground/30 opacity-0 hover:text-destructive group-hover:opacity-100" title="Delete entry">
              <X className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>

      {open ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
          <Input
            type="number"
            min="0"
            step="0.25"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="Hours"
            className="w-20"
          />
          <Select value={deliverableId} onChange={(e) => setDeliverableId(e.target.value)} className="w-auto">
            <option value="">No deliverable</option>
            {deliverables.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Note (optional)…"
            className="flex-1"
          />
          <Button size="sm" onClick={add}>Log</Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="mt-2 rounded-lg px-2 py-1.5 text-left text-sm text-foreground/50 hover:bg-hover">
          + Log time
        </button>
      )}
    </section>
  );
}
