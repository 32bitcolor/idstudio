"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { renameWhiteboard, setWhiteboardStoryboard, deleteWhiteboard } from "@/app/actions/whiteboards";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

const selectClass =
  "h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:border-ring";

export function WhiteboardView({
  whiteboard,
  storyboards,
}: {
  whiteboard: { id: string; title: string; scene: string | null; storyboardId: string | null };
  storyboards: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(whiteboard.title);
  const [storyboardId, setStoryboardId] = useState(whiteboard.storyboardId ?? "");
  const [, startTransition] = useTransition();

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2">
        <Link href="/whiteboards" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Whiteboards
        </Link>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title.trim() && title !== whiteboard.title) startTransition(() => void renameWhiteboard(whiteboard.id, title));
          }}
          className="h-8 w-64 font-medium"
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Storyboard</span>
          <select
            value={storyboardId}
            onChange={(e) => {
              const v = e.target.value;
              setStoryboardId(v);
              startTransition(() => void setWhiteboardStoryboard(whiteboard.id, v || null));
            }}
            className={selectClass}
          >
            <option value="">— none —</option>
            {storyboards.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </label>
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm("Delete this whiteboard?")) startTransition(async () => {
                const res = await deleteWhiteboard(whiteboard.id);
                if (!res?.error) router.push("/whiteboards");
              });
            }}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <WhiteboardCanvas whiteboardId={whiteboard.id} initialScene={whiteboard.scene} />
      </div>
    </div>
  );
}
