"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { listBoardTargets, sendCommentsToBoard, type BoardTarget, type LinkedComment } from "@/app/actions/review-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Result = { created: number; skipped: number; card: { id: string; boardId: string } | null; linked: LinkedComment[] };

/** "Send to board": turn review comments into cards. Mount it only while open — it
 *  loads the boards on mount. */
export function SendToBoardDialog({
  deliverableId,
  commentIds,
  onClose,
  onSent,
}: {
  deliverableId: string;
  commentIds: string[];
  onClose: () => void;
  onSent: (r: Result) => void;
}) {
  const [boards, setBoards] = useState<BoardTarget[] | null>(null);
  const [boardId, setBoardId] = useState("");
  const [columnId, setColumnId] = useState("");
  const [mode, setMode] = useState<"each" | "checklist">("each");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();
  const many = commentIds.length > 1;

  useEffect(() => {
    let active = true;
    listBoardTargets(deliverableId).then((res) => {
      if (!active) return;
      if ("error" in res) {
        setError(res.error ?? "Couldn't load boards.");
        setBoards([]);
        return;
      }
      setBoards(res.boards);
      const b = res.boards.find((x) => x.id === res.defaultBoardId);
      if (b) {
        setBoardId(b.id);
        setColumnId(b.columns[0]?.id ?? "");
      }
    });
    return () => {
      active = false;
    };
  }, [deliverableId]);

  const board = boards?.find((b) => b.id === boardId) ?? null;
  const inProject = boards?.filter((b) => b.inProject) ?? [];
  const others = boards?.filter((b) => !b.inProject) ?? [];

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await sendCommentsToBoard({ commentIds, columnId, mode: many ? mode : "each", title: title || undefined });
      if ("error" in res) {
        setError(res.error ?? "Couldn't create the cards.");
        return;
      }
      setDone(res);
      onSent(res);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{many ? `Send ${commentIds.length} comments to a board` : "Send this comment to a board"}</DialogTitle>
          <DialogDescription>
            The card quotes the comment and links back to it. The comment stays open until you resolve it.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col gap-3 text-sm">
            <p>
              {done.created === 0
                ? "Those comments were already on a board, so nothing new was made."
                : mode === "checklist" && many
                  ? `Made one card with ${done.created} subtask${done.created === 1 ? "" : "s"}.`
                  : `Made ${done.created} card${done.created === 1 ? "" : "s"}.`}
              {done.created > 0 && done.skipped > 0 && ` Skipped ${done.skipped} already on a board.`}
            </p>
            <DialogFooter>
              {done.card && (
                <Button asChild variant="outline">
                  <Link href={`/boards/${done.card.boardId}?card=${done.card.id}`}>Open the card</Link>
                </Button>
              )}
              <Button onClick={onClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {boards === null ? (
              <p className="text-sm text-muted-foreground">Loading boards…</p>
            ) : boards.length === 0 ? (
              <p className="text-sm text-muted-foreground">There are no boards you can add cards to in this workspace.</p>
            ) : (
              <>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Board
                  <Select
                    value={boardId}
                    onChange={(e) => {
                      const b = boards.find((x) => x.id === e.target.value);
                      setBoardId(e.target.value);
                      setColumnId(b?.columns[0]?.id ?? "");
                    }}
                  >
                    {inProject.length > 0 && (
                      <optgroup label="This project">
                        {inProject.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </optgroup>
                    )}
                    {others.length > 0 && (
                      <optgroup label={inProject.length ? "Other boards" : "Boards"}>
                        {others.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </optgroup>
                    )}
                  </Select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Column
                  <Select value={columnId} onChange={(e) => setColumnId(e.target.value)}>
                    {board?.columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </label>
                {many && (
                  <fieldset className="flex flex-col gap-1.5 text-sm">
                    <legend className="mb-1 font-medium">Make</legend>
                    {(
                      [
                        ["each", "One card per comment"],
                        ["checklist", "One card, with a subtask per comment"],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value} className={cn("flex items-center gap-2", mode === value && "font-medium")}>
                        <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="accent-[var(--color-accent)]" />
                        {label}
                      </label>
                    ))}
                    {mode === "checklist" && (
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Card title (optional)"
                        aria-label="Card title"
                        className="mt-1"
                        maxLength={280}
                      />
                    )}
                  </fieldset>
                )}
              </>
            )}
            {error && <p role="alert" className="text-sm text-destructive-ink">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={pending || !columnId}>
                {pending ? "Sending…" : many && mode === "checklist" ? "Make the card" : many ? `Make ${commentIds.length} cards` : "Make the card"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The chip on a comment that's already on a board. */
export function CardChip({ card }: { card: { id: string; boardId: string; key: string | null; done: boolean } }) {
  return (
    <Link
      href={`/boards/${card.boardId}?card=${card.id}`}
      className={cn(
        "inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground",
        card.done && "text-success-ink",
      )}
      title={card.done ? "The card for this comment is done" : "Open the card for this comment"}
    >
      {card.key ?? "Card"}
      {card.done && " · done"}
    </Link>
  );
}
