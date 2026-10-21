"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, MessageSquare, Plus, ShieldCheck, UserRound, X } from "lucide-react";
import { startReviewRound } from "@/app/actions/reviews";
import { REVIEW_STATUS_LABEL, isApproval, type ReviewStatus } from "@/lib/methodology";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";

type Member = { id: string; name: string | null; email: string };
export type RoundSummary = {
  id: string;
  number: number;
  outcome: string | null;
  overridden: boolean;
  dueDate: string | null;
  openComments: number;
  hasSnapshot: boolean;
  reviewers: { id: string; name: string; status: string; guest: Guest | null }[];
};
type Guest = { name: string; email: string };

export function roundTone(outcome: string | null): StatusTone {
  if (outcome === "passed") return "success";
  if (outcome === "changes_requested") return "warning";
  return "info";
}

export function roundLabel(outcome: string | null, overridden: boolean): string {
  if (outcome === "passed") return overridden ? "Passed by override" : "Passed";
  if (outcome === "changes_requested") return "Changes requested";
  return "In review";
}

export const DECISION_DOT: Record<string, string> = {
  requested: "bg-muted-foreground/50",
  in_review: "bg-info",
  changes_requested: "bg-warning",
  approved_with_changes: "bg-success/60",
  approved: "bg-success",
};

/** A deliverable's review rounds, newest first, and the form to start the next one. */
export function ReviewRounds({
  deliverableId,
  members,
  rounds,
}: {
  deliverableId: string;
  members: Member[];
  rounds: RoundSummary[];
}) {
  const [starting, setStarting] = useState(false);
  const latest = rounds[0];

  return (
    <div className="mt-3 flex flex-col gap-2">
      {rounds.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {rounds.map((r) => {
            const approved = r.reviewers.filter((x) => isApproval(x.status)).length;
            return (
              <li key={r.id}>
                <Link
                  href={`/reviews/${r.id}`}
                  className={cn(
                    "group flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-hover",
                    r !== latest && "opacity-80",
                  )}
                >
                  <span className="font-semibold">Round {r.number}</span>
                  <StatusBadge tone={roundTone(r.outcome)}>
                    {r.overridden && <ShieldCheck className="size-3" aria-hidden="true" />}
                    {roundLabel(r.outcome, r.overridden)}
                  </StatusBadge>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {r.reviewers.map((x) => (
                      <span key={x.id} className="inline-flex items-center gap-1" title={REVIEW_STATUS_LABEL[x.status as ReviewStatus] ?? x.status}>
                        <span className={cn("size-1.5 rounded-full", DECISION_DOT[x.status] ?? "bg-muted-foreground/50")} aria-hidden="true" />
                        {x.name}
                        {x.guest && <span className="text-muted-foreground/80">(guest)</span>}
                        <span className="sr-only">: {REVIEW_STATUS_LABEL[x.status as ReviewStatus] ?? x.status}</span>
                      </span>
                    ))}
                    {r.reviewers.length > 1 && <span>· {approved}/{r.reviewers.length} approved</span>}
                  </span>
                  <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                    {r.openComments > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="size-3.5" aria-hidden="true" />
                        {r.openComments} open
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 font-medium text-foreground group-hover:underline">
                      Open review <ArrowRight className="size-3.5" aria-hidden="true" />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {starting ? (
        <StartRoundForm
          deliverableId={deliverableId}
          members={members}
          nextNumber={(latest?.number ?? 0) + 1}
          previousReviewers={latest?.reviewers.filter((r) => !r.guest).map((r) => r.id) ?? []}
          previousGuests={latest?.reviewers.flatMap((r) => (r.guest ? [r.guest] : [])) ?? []}
          onDone={() => setStarting(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setStarting(true)}
          className="flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-hover hover:text-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
          {rounds.length ? `Start round ${(latest?.number ?? 0) + 1}` : "Request a review"}
        </button>
      )}
    </div>
  );
}

function StartRoundForm({
  deliverableId,
  members,
  nextNumber,
  previousReviewers,
  previousGuests,
  onDone,
}: {
  deliverableId: string;
  members: Member[];
  nextNumber: number;
  previousReviewers: string[];
  previousGuests: Guest[];
  onDone: () => void;
}) {
  const router = useRouter();
  // A follow-up round usually goes back to the same people, guests included.
  const [picked, setPicked] = useState<Set<string>>(new Set(previousReviewers));
  const [guests, setGuests] = useState<Guest[]>(previousGuests);
  const [due, setDue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await startReviewRound(
        deliverableId,
        { memberIds: [...picked], guests },
        due ? new Date(due).toISOString() : null,
      );
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      onDone();
      if (res && "roundId" in res) router.push(`/reviews/${res.roundId}`);
    });
  }

  const count = picked.size + guests.length;

  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-border p-3">
      <legend className="px-1 text-sm font-semibold">Start round {nextNumber}</legend>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Reviewers — the round passes when all of them approve
        </span>
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => {
            const on = picked.has(m.id);
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(m.id)}
                className={cn(
                  "h-7 rounded-full border px-2.5 text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  on ? "border-accent/40 bg-accent/10 text-foreground" : "border-dashed border-border-strong text-muted-foreground hover:bg-hover",
                )}
              >
                {m.name ?? m.email}
              </button>
            );
          })}
        </div>
      </div>
      <GuestList guests={guests} onChange={setGuests} />
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs font-medium text-muted-foreground">Due</span>
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-8 w-auto" />
      </label>
      {error && <p role="alert" className="text-sm text-destructive-ink">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={pending || count === 0}>
          {pending ? "Starting…" : `Start round ${nextNumber}`}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </fieldset>
  );
}

/** Outside reviewers (SMEs without an account): name + email. Each gets a personal
 *  review link by email when the round starts. */
export function GuestList({ guests, onChange }: { guests: Guest[]; onChange: (g: Guest[]) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    const n = name.trim();
    const e = email.trim().toLowerCase();
    if (!n || !e) return setError("Enter a name and an email.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return setError("That email doesn't look right.");
    if (guests.some((g) => g.email === e)) return setError("They're already on the list.");
    onChange([...guests, { name: n, email: e }]);
    setName("");
    setEmail("");
    setError(null);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">Guests — outside reviewers, no account needed</span>
      {guests.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {guests.map((g) => (
            <li
              key={g.email}
              className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 pr-1 pl-2.5 text-xs font-medium"
            >
              <UserRound className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{g.name}</span>
              <span className="truncate font-normal text-muted-foreground">{g.email}</span>
              <button
                type="button"
                onClick={() => onChange(guests.filter((x) => x.email !== g.email))}
                className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-hover hover:text-foreground"
                aria-label={`Remove ${g.name}`}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div
        className="flex flex-wrap gap-1.5"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Guest name" className="h-8 w-40 grow sm:grow-0" />
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          aria-label="Guest email"
          className="h-8 w-56 grow sm:grow-0"
        />
        <Button size="sm" variant="outline" type="button" onClick={add}>
          <Plus className="size-3.5" aria-hidden="true" /> Add guest
        </Button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive-ink">{error}</p>}
    </div>
  );
}
