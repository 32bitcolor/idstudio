"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowRightLeft } from "lucide-react";
import { listMoveTargets, moveCardToBoard } from "@/app/actions/boards";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Target = Awaited<ReturnType<typeof listMoveTargets>>[number];
export type MoveResult = { boardId: string; boardName: string; key: string | null; leftSprint: boolean };

/** Card drawer → "Move to board…": pick a board and a column; the card lands at the
 *  bottom of it, with its subtasks, comments and attachments. */
export function MoveCardDialog({
  cardId,
  currentKey,
  statusId,
  onMoved,
}: {
  cardId: string;
  currentKey: string | null;
  /** The card's current status, to preselect the matching column on the new board. */
  statusId: string | null;
  onMoved: (result: MoveResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [boardId, setBoardId] = useState("");
  const [columnId, setColumnId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let active = true;
    listMoveTargets(cardId).then((t) => {
      if (!active) return;
      setTargets(t);
      if (t[0]) pick(t[0]);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cardId]);

  function pick(board: Target) {
    setBoardId(board.id);
    setColumnId((board.columns.find((c) => statusId && c.statusId === statusId) ?? board.columns[0]).id);
  }

  const board = targets?.find((b) => b.id === boardId) ?? null;

  function move() {
    setError(null);
    startTransition(async () => {
      const res = await moveCardToBoard(cardId, columnId);
      if ("error" in res) {
        setError(res.error ?? "Couldn't move the card.");
        return;
      }
      setOpen(false);
      onMoved(res);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setTargets(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="link" className="h-auto p-0 text-sm">
          <ArrowRightLeft className="size-4" />
          Move to board…
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move to another board</DialogTitle>
          <DialogDescription>
            The card moves with its subtasks, comments, attachments and links.
            {currentKey && <> It gets a key on the new board; links to {currentKey} keep working.</>}
          </DialogDescription>
        </DialogHeader>
        {!targets ? (
          <p className="text-sm text-muted-foreground">Loading boards…</p>
        ) : targets.length === 0 ? (
          <p className="text-sm text-muted-foreground">There are no other boards you can move it to.</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              move();
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="move-board" className="text-sm font-medium">Board</label>
              <Select
                id="move-board"
                value={boardId}
                onChange={(e) => {
                  const b = targets.find((t) => t.id === e.target.value);
                  if (b) pick(b);
                }}
              >
                {targets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.projectName ? ` (${b.projectName})` : ""}
                  </option>
                ))}
              </Select>
            </div>
            {board && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="move-column" className="text-sm font-medium">Column</label>
                <Select id="move-column" value={columnId} onChange={(e) => setColumnId(e.target.value)}>
                  {board.columns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </div>
            )}
            {error && <p role="alert" className="text-sm text-destructive-ink">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending || !columnId}>
                {pending ? "Moving…" : "Move card"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
