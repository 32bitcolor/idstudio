"use client";

import * as React from "react";
import { useTransition } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Replaces the app's scattered native confirm() deletes with one consistent,
 * styled, accessible confirmation dialog. `trigger` is any element (usually a
 * destructive Button); `onConfirm` runs the delete server action.
 *
 * If `onConfirm` resolves to an `{ error }` object (the shape server actions
 * return on failure), the dialog stays open and shows the message instead of
 * closing as though the delete succeeded.
 */
export function ConfirmDelete({
  trigger,
  onConfirm,
  title = "Delete this item?",
  description = "This action can't be undone.",
  confirmLabel = "Delete",
}: {
  trigger: React.ReactNode;
  /** The delete action. If it returns `{ error }`, the dialog surfaces it. */
  onConfirm: () => unknown | Promise<unknown>;
  title?: string;
  description?: string;
  confirmLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function handleConfirm(e: React.MouseEvent) {
    // Prevent Radix's default close-on-click so we only dismiss on success.
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await onConfirm();
      if (res && typeof res === "object" && "error" in res && res.error) {
        setError(String((res as { error: unknown }).error));
        return;
      }
      setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/40"
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? "Deleting…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
