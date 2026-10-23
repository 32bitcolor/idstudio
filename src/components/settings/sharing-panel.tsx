"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminUnshareBoard, setPublicBoardsEnabled } from "@/app/actions/board-share";
import { LocalTime } from "@/components/shared/local-time";

type SharedBoard = {
  id: string;
  name: string;
  url: string;
  showAssignees: boolean;
  sharedAt: string | null;
  sharedBy: string | null;
};

export function SharingPanel({ enabled: initial, boards }: { enabled: boolean; boards: SharedBoard[] }) {
  const [enabled, setEnabled] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setError(null);
    startTransition(async () => {
      const res = await setPublicBoardsEnabled(next);
      if ("error" in res) {
        setEnabled(!next);
        setError(res.error ?? null);
      }
    });
  }

  function unshare(id: string) {
    startTransition(async () => {
      const res = await adminUnshareBoard(id);
      if ("error" in res) setError(res.error ?? null);
      else router.refresh();
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <section className="rounded-xl border border-border p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent">
            <Globe className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-medium">Public board links</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Members can share a board as a read-only link anyone can open without signing in. Cards marked
              Private, comments, attachments, SMEs and reviews are never shown.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant={enabled ? "outline" : "default"} size="sm" disabled={pending} onClick={toggle}>
                {enabled ? "Turn off public links" : "Allow public links"}
              </Button>
              <span className="text-sm text-muted-foreground">
                {enabled
                  ? "Allowed"
                  : "Off: every shared board shows a not-found page, and no new links can be made. Turning this back on restores the existing links."}
              </span>
            </div>
            {error && <p className="mt-2 text-sm text-destructive-ink">{error}</p>}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border">
        <h2 className="border-b border-border px-5 py-3 font-medium">Shared boards · {boards.length}</h2>
        {boards.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">No boards are shared publicly.</p>
        ) : (
          <ul className="divide-y divide-border">
            {boards.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/boards/${b.id}`} className="font-medium hover:underline">
                    {b.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {b.sharedBy ? `Shared by ${b.sharedBy}` : "Shared"}
                    {b.sharedAt &&
                      <> on <LocalTime iso={b.sharedAt} /></>}
                    {b.showAssignees && " · shows assignees"}
                  </p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <a href={b.url} target="_blank" rel="noopener noreferrer">Open</a>
                </Button>
                <Button variant="outline" size="sm" disabled={pending} onClick={() => unshare(b.id)}>
                  Turn off link
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
