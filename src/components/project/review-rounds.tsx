"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, MessageSquare, Plus, ShieldCheck } from "lucide-react";
import { startReviewRound } from "@/app/actions/reviews";
import { REVIEW_STATUS_LABEL, type ReviewStatus } from "@/lib/methodology";
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
  reviewers: { id: string; name: string; status: string }[];
};

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

const DECISION_DOT: Record<string, string> = {
  requested: "bg-muted-foreground/50",
  in_review: "bg-info",
  changes_requested: "bg-warning",
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
            const approved = r.reviewers.filter((x) => x.status === "approved").length;
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
          previousReviewers={latest?.reviewers.map((r) => r.id) ?? []}
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
  onDone,
}: {
  deliverableId: string;
  members: Member[];
  nextNumber: number;
  previousReviewers: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  // A follow-up round usually goes back to the same people.
  const [picked, setPicked] = useState<Set<string>>(new Set(previousReviewers));
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
      const res = await startReviewRound(deliverableId, [...picked], due ? new Date(due).toISOString() : null);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      onDone();
      if (res && "roundId" in res) router.push(`/reviews/${res.roundId}`);
    });
  }

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
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs font-medium text-muted-foreground">Due</span>
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-8 w-auto" />
      </label>
      {error && <p role="alert" className="text-sm text-destructive-ink">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={pending || picked.size === 0}>
          {pending ? "Starting…" : `Start round ${nextNumber}`}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </fieldset>
  );
}
