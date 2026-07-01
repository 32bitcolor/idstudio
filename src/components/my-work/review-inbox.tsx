"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, MessageSquare, RotateCcw } from "lucide-react";
import { setReviewStatus, setReviewFeedback } from "@/app/actions/reviews";
import { dueMeta, dueToneClass } from "@/lib/due";
import { REVIEW_STATUS_LABEL, type ReviewStatus } from "@/lib/methodology";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";

export type InboxReview = {
  id: string;
  round: number;
  status: string;
  dueIso: string | null;
  feedback: string | null;
  requestedBy: string | null;
  deliverableName: string;
  projectName: string;
  projectId: string;
  link: { href: string; label: string };
};

export function ReviewInbox({ reviews }: { reviews: InboxReview[] }) {
  const [items, setItems] = useState(reviews);

  function drop(id: string) {
    setItems((prev) => prev.filter((r) => r.id !== id));
  }
  function patch(id: string, status: string) {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((r) => (
        <ReviewItem key={r.id} review={r} onDrop={drop} onPatch={patch} />
      ))}
    </div>
  );
}

function ReviewItem({
  review,
  onDrop,
  onPatch,
}: {
  review: InboxReview;
  onDrop: (id: string) => void;
  onPatch: (id: string, status: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState(review.feedback ?? "");
  const [err, setErr] = useState<string | null>(null);
  const due = dueMeta(review.dueIso);

  function act(status: "in_review" | "approved" | "changes_requested") {
    setErr(null);
    startTransition(async () => {
      // Persist any typed feedback first (esp. when requesting changes).
      if (feedback.trim() !== (review.feedback ?? "").trim()) {
        await setReviewFeedback(review.id, feedback);
      }
      const res = await setReviewStatus(review.id, status);
      if (res?.error) { setErr(res.error); return; }
      if (status === "in_review") onPatch(review.id, status);
      else onDrop(review.id); // approved / changes_requested leave the reviewer's queue
    });
  }

  function saveNote() {
    setErr(null);
    startTransition(async () => {
      const res = await setReviewFeedback(review.id, feedback);
      if (res?.error) setErr(res.error);
    });
  }

  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={review.link.href} className="truncate font-medium hover:underline">
              {review.deliverableName}
            </Link>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              round {review.round}
            </span>
            <StatusBadge tone={review.status === "in_review" ? "info" : "neutral"}>
              {REVIEW_STATUS_LABEL[review.status as ReviewStatus] ?? review.status}
            </StatusBadge>
            {due && <span className={`text-xs ${dueToneClass[due.tone]}`}>{due.label}</span>}
          </div>
          <div className="mt-0.5 truncate text-sm text-muted-foreground">
            <Link href={`/projects/${review.projectId}`} className="hover:underline">{review.projectName}</Link>
            {" · "}
            <Link href={review.link.href} className="hover:underline">{review.link.label}</Link>
            {review.requestedBy ? ` · requested by ${review.requestedBy}` : ""}
          </div>
        </div>
      </div>

      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Add review feedback (shared with the requester)…"
        rows={2}
        className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring"
      />

      {err && <p className="text-sm text-destructive">{err}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => act("approved")} disabled={pending}>
          <Check className="size-4" /> Approve
        </Button>
        <Button size="sm" variant="outline" onClick={() => act("changes_requested")} disabled={pending}>
          <RotateCcw className="size-4" /> Request changes
        </Button>
        {review.status !== "in_review" && (
          <Button size="sm" variant="ghost" onClick={() => act("in_review")} disabled={pending}>
            Mark in review
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={saveNote} disabled={pending} className="ml-auto text-muted-foreground">
          <MessageSquare className="size-4" /> Save note
        </Button>
      </div>
    </Card>
  );
}
