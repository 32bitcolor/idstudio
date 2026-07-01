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
 */
export function ConfirmDelete({
  trigger,
  onConfirm,
  title = "Delete this item?",
  description = "This action can't be undone.",
  confirmLabel = "Delete",
}: {
  trigger: React.ReactNode;
  /** The delete action. Return value is ignored (server actions may return an error object). */
  onConfirm: () => unknown | Promise<unknown>;
  title?: string;
  description?: string;
  confirmLabel?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/40"
            onClick={() => start(async () => { await onConfirm(); })}
            disabled={pending}
          >
            {pending ? "Deleting…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
