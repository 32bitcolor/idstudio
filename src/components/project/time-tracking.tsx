"use client";

import { useState, useTransition } from "react";
import { addTimeEntry, deleteTimeEntry } from "@/app/actions/time";

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

const control = "rounded-md border border-border-strong bg-transparent px-2 py-1 text-sm outline-none";

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
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">Time tracking</h2>
        {total > 0 && <span className="text-sm text-foreground/60">{fmtHours(total)}h total</span>}
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        {entries.length === 0 && <p className="text-sm text-foreground/40">No time logged yet.</p>}
        {entries.map((e) => (
          <div key={e.id} className="group flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
            <span className="w-14 shrink-0 text-foreground/50">{fmtDate(e.loggedFor)}</span>
            <span className="w-16 shrink-0 font-medium">{fmtDuration(e.minutes)}</span>
            <span className="shrink-0 text-foreground/60">{e.user.name ?? e.user.email}</span>
            {e.deliverable && <span className="truncate rounded bg-muted px-1.5 py-0.5 text-xs text-foreground/70">{e.deliverable.name}</span>}
            <span className="flex-1 truncate text-foreground/60">{e.note}</span>
            <button onClick={() => remove(e.id)} className="shrink-0 text-foreground/30 opacity-0 hover:text-red-600 group-hover:opacity-100" title="Delete entry">
              ×
            </button>
          </div>
        ))}
      </div>

      {open ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={control} />
          <input
            type="number"
            min="0"
            step="0.25"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="Hours"
            className={`w-20 ${control}`}
          />
          <select value={deliverableId} onChange={(e) => setDeliverableId(e.target.value)} className={control}>
            <option value="">No deliverable</option>
            {deliverables.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Note (optional)…"
            className={`flex-1 ${control}`}
          />
          <button onClick={add} className="rounded-md bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">Log</button>
          <button onClick={() => setOpen(false)} className="rounded-md px-2 py-1 text-sm text-foreground/60 hover:bg-hover">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="mt-2 rounded-lg px-2 py-1.5 text-left text-sm text-foreground/50 hover:bg-hover">
          + Log time
        </button>
      )}
    </section>
  );
}
