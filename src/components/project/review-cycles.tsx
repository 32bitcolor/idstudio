"use client";

import { useState, useTransition } from "react";
import {
  addReviewCycle,
  setReviewStatus,
  setReviewFeedback,
  setReviewDue,
  deleteReviewCycle,
} from "@/app/actions/reviews";
import { REVIEW_STATUSES, REVIEW_STATUS_LABEL, type ReviewStatus } from "@/lib/methodology";

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

const control = "rounded border border-border-strong bg-transparent px-1.5 py-0.5 text-xs outline-none";
const STATUS_DOT: Record<string, string> = {
  requested: "bg-foreground/30",
  in_review: "bg-blue-500",
  changes_requested: "bg-amber-500",
  approved: "bg-green-500",
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
    startTransition(() => void setReviewStatus(r.id, status));
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
      <button onClick={() => setOpen((o) => !o)} className="text-xs text-foreground/60 hover:underline">
        {open ? "▾" : "▸"} Reviews ({reviews.length})
        {latest && !open ? ` · latest: ${REVIEW_STATUS_LABEL[latest.status as ReviewStatus] ?? latest.status}` : ""}
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2 border-l-2 border-border pl-3">
          {reviews.length === 0 && <p className="text-xs text-foreground/40">No review rounds yet.</p>}
          {reviews.map((r) => (
            <div key={r.id} className="rounded-md border border-border p-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[r.status] ?? "bg-foreground/30"}`} />
                <span className="font-medium">Round {r.round}</span>
                <span className="text-foreground/60">{r.reviewer.name ?? r.reviewer.email}</span>
                <select value={r.status} onChange={(e) => changeStatus(r, e.target.value)} className={control}>
                  {REVIEW_STATUSES.map((s) => (
                    <option key={s} value={s}>{REVIEW_STATUS_LABEL[s]}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={r.dueDate ? r.dueDate.slice(0, 10) : ""}
                  onChange={(e) => changeDue(r, e.target.value)}
                  className={control}
                />
                <button onClick={() => remove(r.id)} className="ml-auto text-foreground/40 hover:text-red-600" title="Delete review">×</button>
              </div>
              <textarea
                defaultValue={r.feedback ?? ""}
                onBlur={(e) => startTransition(() => void setReviewFeedback(r.id, e.target.value))}
                rows={2}
                placeholder="Feedback…"
                className="mt-1.5 w-full resize-none rounded border border-border-strong bg-transparent px-2 py-1 outline-none"
              />
            </div>
          ))}

          {adding ? (
            <div className="flex flex-wrap items-center gap-2">
              <select value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} className={control}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name ?? m.email}</option>
                ))}
              </select>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={control} />
              <button onClick={add} className="rounded bg-accent px-2 py-1 text-xs font-medium text-accent-foreground">
                Request review
              </button>
              <button onClick={() => setAdding(false)} className="rounded px-2 py-1 text-xs text-foreground/60 hover:bg-hover">
                Cancel
              </button>
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
