"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import {
  addReviewCycle,
  setReviewStatus,
  setReviewFeedback,
  setReviewDue,
  deleteReviewCycle,
} from "@/app/actions/reviews";
import { REVIEW_STATUSES, REVIEW_STATUS_LABEL, type ReviewStatus } from "@/lib/methodology";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";

type Member = { id: string; name: string | null; email: string };
type Review = {
  id: string;
  round: number;
  reviewerId: string;
  status: string;
  dueDate: string | null;
  feedback: string | null;
  reviewer: Member;
};

const STATUS_DOT: Record<string, string> = {
  requested: "bg-foreground/30",
  in_review: "bg-info",
  changes_requested: "bg-warning",
  approved: "bg-success",
};

export function ReviewCycles({
  deliverableId,
  members,
  initial,
}: {
  deliverableId: string;
  members: Member[];
  initial: Review[];
}) {
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>(initial);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [reviewerId, setReviewerId] = useState(members[0]?.id ?? "");
  const [due, setDue] = useState("");
  const [, startTransition] = useTransition();

  function patch(id: string, p: Partial<Review>) {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }

  async function add() {
    if (!reviewerId) return;
    const res = await addReviewCycle(deliverableId, reviewerId, due ? new Date(due).toISOString() : null);
    if ("review" in res && res.review) {
      setReviews((prev) => [...prev, res.review]);
      setDue("");
      setAdding(false);
    }
  }

  function changeStatus(r: Review, status: string) {
    patch(r.id, { status });
    startTransition(async () => {
      await setReviewStatus(r.id, status);
      // Picks up the root-layout revalidation so the header's badge count
      // (reviews awaiting the reviewer's decision) updates immediately.
      router.refresh();
    });
  }
  function changeDue(r: Review, value: string) {
    const iso = value ? new Date(value).toISOString() : null;
    patch(r.id, { dueDate: iso });
    startTransition(() => void setReviewDue(r.id, iso));
  }
  function remove(id: string) {
    setReviews((prev) => prev.filter((r) => r.id !== id));
    startTransition(() => void deleteReviewCycle(id));
  }

  const latest = reviews[reviews.length - 1];

  return (
    <div className="mt-2">
      <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline">
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />} Reviews ({reviews.length})
        {latest && !open ? ` · latest: ${REVIEW_STATUS_LABEL[latest.status as ReviewStatus] ?? latest.status}` : ""}
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2 border-l-2 border-border pl-3">
          {reviews.length === 0 && <p className="text-xs text-muted-foreground">No review rounds yet.</p>}
          {reviews.map((r) => (
            <div key={r.id} className="rounded-md border border-border p-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[r.status] ?? "bg-foreground/30"}`} />
                <span className="font-medium">Round {r.round}</span>
                <span className="text-muted-foreground">{r.reviewer.name ?? r.reviewer.email}</span>
                <Select value={r.status} onChange={(e) => changeStatus(r, e.target.value)} className="h-7 w-auto py-0.5 text-xs">
                  {REVIEW_STATUSES.map((s) => (
                    <option key={s} value={s}>{REVIEW_STATUS_LABEL[s]}</option>
                  ))}
                </Select>
                <Input
                  type="date"
                  value={r.dueDate ? r.dueDate.slice(0, 10) : ""}
                  onChange={(e) => changeDue(r, e.target.value)}
                  className="h-7 w-auto px-1.5 py-0.5 text-xs"
                />
                <Button variant="ghost" size="icon-xs" onClick={() => remove(r.id)} className="ml-auto text-muted-foreground hover:text-destructive" title="Delete review">
                  <X className="size-3.5" />
                </Button>
              </div>
              <Textarea
                defaultValue={r.feedback ?? ""}
                onBlur={(e) => startTransition(() => void setReviewFeedback(r.id, e.target.value))}
                rows={2}
                placeholder="Feedback…"
                className="mt-1.5 min-h-0 w-full resize-none text-xs"
              />
            </div>
          ))}

          {adding ? (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} className="h-7 w-auto py-0.5 text-xs">
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name ?? m.email}</option>
                ))}
              </Select>
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-7 w-auto px-1.5 py-0.5 text-xs" />
              <Button size="xs" onClick={add}>Request review</Button>
              <Button size="xs" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="rounded px-1 py-1 text-left text-xs text-foreground/50 hover:bg-hover">
              + Request a review
            </button>
          )}
        </div>
      )}
    </div>
  );
}
