"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { renameWhiteboard, setWhiteboardStoryboard, deleteWhiteboard } from "@/app/actions/whiteboards";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { InlineTitle } from "@/components/shared/inline-title";
import { useSetPageTitle } from "@/components/app-shell/breadcrumbs";

// Excalidraw touches `window`, so it must load client-only.
const WhiteboardCanvas = dynamic(
  () => import("@/components/whiteboard/whiteboard-canvas").then((m) => m.WhiteboardCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading canvas…</div>
    ),
  },
);

export function WhiteboardView({
  whiteboard,
  storyboards,
}: {
  whiteboard: { id: string; title: string; scene: string | null; storyboardId: string | null };
  storyboards: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(whiteboard.title);
  useSetPageTitle(title || "Untitled whiteboard");
  const [storyboardId, setStoryboardId] = useState(whiteboard.storyboardId ?? "");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-3">
        <div className="min-w-[12rem] flex-1">
          <InlineTitle
            value={title}
            onChange={setTitle}
            onCommit={() => {
              if (title.trim() && title !== whiteboard.title) startTransition(() => void renameWhiteboard(whiteboard.id, title));
            }}
            ariaLabel="Whiteboard name"
          />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Select
            aria-label="Linked storyboard"
            value={storyboardId}
            onChange={(e) => {
              const v = e.target.value;
              setStoryboardId(v);
              startTransition(() => void setWhiteboardStoryboard(whiteboard.id, v || null));
            }}
            className="h-8 w-auto max-w-64"
          >
            <option value="">No linked storyboard</option>
            {storyboards.map((s) => (
              <option key={s.id} value={s.id}>Storyboard: {s.title}</option>
            ))}
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="Whiteboard settings">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                <Trash2 className="size-4" />
                Delete whiteboard…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <ConfirmDelete
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete this whiteboard?"
          description="This permanently deletes the whiteboard and its canvas."
          confirmLabel="Delete whiteboard"
          onConfirm={async () => {
            const res = await deleteWhiteboard(whiteboard.id);
            if (!res?.error) router.push("/whiteboards");
          }}
        />
      </header>

      <div className="relative min-h-0 flex-1">
        <WhiteboardCanvas whiteboardId={whiteboard.id} initialScene={whiteboard.scene} />
      </div>
    </div>
  );
}
