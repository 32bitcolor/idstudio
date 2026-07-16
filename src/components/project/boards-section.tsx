"use client";

import { useState } from "react";
import Link from "next/link";
import { Columns3, Plus } from "lucide-react";

import { createProjectBoard, setBoardProject } from "@/app/actions/boards";
import { SectionHeader } from "@/components/shared/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type BoardRef = { id: string; name: string; columnCount: number };

export function BoardsSection({
  projectId,
  initial,
  available,
}: {
  projectId: string;
  initial: BoardRef[];
  available: BoardRef[];
}) {
  const [boards, setBoards] = useState<BoardRef[]>(initial);
  const [unassigned, setUnassigned] = useState<BoardRef[]>(available);
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function addExisting(boardId: string) {
    const board = unassigned.find((b) => b.id === boardId);
    if (!board) return;
    setUnassigned((prev) => prev.filter((b) => b.id !== boardId));
    setBoards((prev) => [...prev, board]);
    const res = await setBoardProject(boardId, projectId);
    if (res && "error" in res && res.error) {
      // revert
      setBoards((prev) => prev.filter((b) => b.id !== boardId));
      setUnassigned((prev) => [...prev, board]);
      setError(res.error);
    }
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setError(null);
    const res = await createProjectBoard(projectId, trimmed);
    setPending(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    if ("board" in res && res.board) {
      setBoards((prev) => [...prev, { id: res.board.id, name: res.board.name, columnCount: 3 }]);
      setName("");
      setOpen(false);
    }
  }

  return (
    <section className="mt-8">
      <SectionHeader>Boards</SectionHeader>
      <div className="flex flex-col gap-2">
        {boards.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No boards yet — add one to track this project&rsquo;s execution work.
          </p>
        )}
        {boards.map((b) => (
          <Link
            key={b.id}
            href={`/boards/${b.id}`}
            className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm transition-colors hover:border-border-strong"
          >
            <Columns3 className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate font-medium">{b.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {b.columnCount} {b.columnCount === 1 ? "column" : "columns"}
            </span>
          </Link>
        ))}
      </div>

      {open ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") { setName(""); setOpen(false); }
            }}
            placeholder="Board name…"
            className="w-full sm:w-72"
          />
          <Button size="sm" onClick={submit} disabled={pending}>
            {pending ? "Creating…" : "Add"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setName(""); setOpen(false); setError(null); }}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg px-2 py-1.5 text-left text-sm text-foreground/50 hover:bg-hover"
          >
            <Plus className="mr-1 inline size-3.5" /> Add a board
          </button>
          {unassigned.length > 0 && (
            <Select
              value=""
              onChange={(e) => e.target.value && addExisting(e.target.value)}
              className="h-8 w-auto py-1 text-xs"
              aria-label="Add an existing board to this project"
            >
              <option value="">Add existing board…</option>
              {unassigned.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-1 text-sm text-destructive">{error}</p>}
    </section>
  );
}
