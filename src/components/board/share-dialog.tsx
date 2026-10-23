"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, Globe, Lock } from "lucide-react";
import {
  getBoardShare,
  setBoardShareAssignees,
  shareBoard,
  unshareBoard,
  type BoardShareState,
} from "@/app/actions/board-share";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Board menu → "Share publicly…": a read-only link anyone can open (lib/board-share.ts). */
export function ShareDialog({
  boardId,
  open,
  onOpenChange,
  onShared,
}: {
  boardId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onShared: (shared: boolean) => void;
}) {
  const [share, setShare] = useState<BoardShareState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let active = true;
    getBoardShare(boardId).then((res) => {
      if (!active) return;
      if ("error" in res) setError(res.error);
      else setShare(res);
    });
    return () => {
      active = false;
    };
  }, [boardId, open]);

  function run(action: () => Promise<BoardShareState | { error: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setShare(res);
      onShared(res.url !== null);
    });
  }

  function copy() {
    if (!share?.url) return;
    navigator.clipboard.writeText(share.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setConfirmReset(false);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this board publicly</DialogTitle>
          <DialogDescription>
            Anyone with the link can see this board, read-only, without signing in.
          </DialogDescription>
        </DialogHeader>

        {!share ? (
          <p className="text-sm text-muted-foreground">{error ?? "Loading…"}</p>
        ) : !share.allowed && !share.url ? (
          <p className="text-sm text-muted-foreground">An admin has turned off public board links for this workspace.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {share.url ? (
              <>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted px-3 py-2 text-xs">{share.url}</code>
                  <Button variant="outline" size="sm" onClick={copy}>
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                {!share.allowed && (
                  <p className="text-sm text-warning-ink">
                    An admin has turned off public board links, so this link shows a not-found page for now.
                  </p>
                )}
                {share.sharedBy && share.sharedAt && (
                  <p className="text-xs text-muted-foreground">
                    Shared by {share.sharedBy} on{" "}
                    {new Date(share.sharedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}.
                  </p>
                )}
              </>
            ) : (
              <Button className="self-start" disabled={pending} onClick={() => run(() => shareBoard(boardId))}>
                <Globe className="size-4" />
                Create public link
              </Button>
            )}

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={share.showAssignees}
                disabled={pending}
                onChange={(e) => {
                  const show = e.target.checked;
                  const before = share;
                  setShare({ ...share, showAssignees: show });
                  setError(null);
                  startTransition(async () => {
                    const res = await setBoardShareAssignees(boardId, show);
                    if ("error" in res) {
                      setShare(before);
                      setError(res.error);
                    } else setShare(res);
                  });
                }}
              />
              <span>
                Show who&rsquo;s assigned
                <span className="block text-xs text-muted-foreground">Names only, never email addresses.</span>
              </span>
            </label>

            <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
              <p>
                Visitors see the columns and each card&rsquo;s title, labels, due date, subtask progress and
                description. They never see comments, attachments, SMEs or reviews.
              </p>
              <p className="mt-1.5 flex items-center gap-1.5">
                <Lock className="size-3.5 shrink-0" aria-hidden="true" />
                Mark a card <strong className="font-semibold text-foreground">Private</strong> (in the card) to leave it off the link.
              </p>
            </div>

            {share.url && (
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                {confirmReset ? (
                  <>
                    <span className="text-sm">The current link will stop working.</span>
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => { setConfirmReset(false); run(() => shareBoard(boardId)); }}>
                      Reset link
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="outline" disabled={pending || !share.allowed} onClick={() => setConfirmReset(true)}>
                      Reset link…
                    </Button>
                    <Button size="sm" variant="destructive" disabled={pending} onClick={() => run(() => unshareBoard(boardId))}>
                      Stop sharing
                    </Button>
                  </>
                )}
              </div>
            )}
            {error && <p role="alert" className="text-sm text-destructive-ink">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
