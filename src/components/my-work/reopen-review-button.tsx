"use client";

import { useState, useTransition } from "react";
import { Undo2 } from "lucide-react";
import { setReviewStatus } from "@/app/actions/reviews";
import { Button } from "@/components/ui/button";

// Reopen a resolved review — undo an accidental approval (or a change request),
// sending it back to "in review" so it returns to the reviewer's queue.
export function ReopenReviewButton({ reviewId, approved }: { reviewId: string; approved: boolean }) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function reopen() {
    setErr(null);
    startTransition(async () => {
      const res = await setReviewStatus(reviewId, "in_review");
      if (res?.error) setErr(res.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {err && <span className="text-xs text-destructive">{err}</span>}
      <Button
        variant="ghost"
        size="sm"
        onClick={reopen}
        disabled={pending}
        className="text-muted-foreground"
        title={approved ? "Undo this approval" : "Reopen this review"}
      >
        <Undo2 className="size-4" /> {approved ? "Undo approval" : "Reopen"}
      </Button>
    </div>
  );
}
