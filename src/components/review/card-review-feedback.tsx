"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, CircleSlash, Quote } from "lucide-react";
import { setReviewCommentsStatus } from "@/app/actions/review-feedback";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";

export type CardReviewComment = {
  id: string;
  roundId: string;
  roundNumber: number;
  deliverableName: string;
  status: string;
  excerpt: string;
  quote: string | null;
  author: string;
  /** Set when the comment went to one of this card's subtasks (a checklist card). */
  subtask: { id: string; title: string } | null;
};

/** In the card panel: the review comments a card was made from. Once the work is done
 *  (the card is in a done status, or the comment's subtask is ticked), it offers to
 *  resolve them, so the reviewer sees the outcome without anyone visiting the round. */
export function CardReviewFeedback({
  items,
  cardDone,
  doneSubtasks,
}: {
  items: CardReviewComment[];
  cardDone: boolean;
  doneSubtasks: Set<string>;
}) {
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const statusOf = (c: CardReviewComment) => statuses[c.id] ?? c.status;
  const workDone = (c: CardReviewComment) => (c.subtask ? doneSubtasks.has(c.subtask.id) : cardDone);
  const ready = items.filter((c) => statusOf(c) === "open" && workDone(c));

  function resolve(ids: string[]) {
    setError(null);
    startTransition(async () => {
      const res = await setReviewCommentsStatus(ids, "resolved", null);
      if (res && "error" in res) setError(res.error ?? "Couldn't resolve.");
      else setStatuses((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, "resolved"])) }));
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {ready.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-success/40 bg-success/5 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">
            {ready.length === items.length && !items.some((c) => c.subtask)
              ? "This card is done."
              : `${ready.length} comment${ready.length === 1 ? "'s" : "s'"} work is done.`}{" "}
            Resolve {ready.length === 1 ? "the review comment" : "those review comments"} so the reviewer sees it?
          </span>
          <Button size="xs" onClick={() => resolve(ready.map((c) => c.id))} disabled={pending}>
            <Check className="size-3" aria-hidden="true" /> Resolve{ready.length > 1 ? ` ${ready.length}` : ""}
          </Button>
        </div>
      )}
      {items.map((c) => {
        const status = statusOf(c);
        return (
          <div key={c.id} className="rounded-md border border-border px-2.5 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{c.author}</span>
              <span>· {c.deliverableName}, round {c.roundNumber}</span>
              {status !== "open" && (
                <StatusBadge tone={status === "resolved" ? "success" : "neutral"}>
                  {status === "resolved" ? <Check className="size-3" aria-hidden="true" /> : <CircleSlash className="size-3" aria-hidden="true" />}
                  {status === "resolved" ? "Resolved" : "Won't fix"}
                </StatusBadge>
              )}
            </div>
            {c.subtask && <p className="mt-0.5 truncate text-xs text-muted-foreground">Subtask: {c.subtask.title}</p>}
            {c.quote && (
              <blockquote className="mt-1 flex gap-1.5 border-l-2 border-accent/60 pl-2 text-xs text-muted-foreground">
                <Quote className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                {c.quote}
              </blockquote>
            )}
            <p className="mt-1">{c.excerpt}</p>
            <div className="mt-1 flex items-center gap-1">
              <Link
                href={`/reviews/${c.roundId}?thread=${c.id}`}
                className="text-xs font-medium text-accent underline-offset-2 hover:underline"
              >
                Open in the review →
              </Link>
              {status === "open" && (
                <Button size="xs" variant="ghost" className="ml-auto" onClick={() => resolve([c.id])} disabled={pending}>
                  <Check className="size-3" aria-hidden="true" /> Resolve
                </Button>
              )}
            </div>
          </div>
        );
      })}
      {error && <p role="alert" className="text-xs text-destructive-ink">{error}</p>}
    </div>
  );
}
