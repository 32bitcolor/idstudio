"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  renameStoryboard,
  setStoryboardStatus,
  updateStoryboardDescription,
  deleteStoryboard,
} from "@/app/actions/storyboards";
import { STORYBOARD_STATUSES, STORYBOARD_STATUS_LABEL, type StoryboardStatus } from "@/lib/storyboard";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { ScreensSection, type ScreenInit } from "@/components/storyboard/screens-section";

type StoryboardMeta = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  deliverable: { id: string; name: string; projectId: string; projectName: string } | null;
};

export function StoryboardView({ storyboard, initialScreens }: { storyboard: StoryboardMeta; initialScreens: ScreenInit[] }) {
  const [title, setTitle] = useState(storyboard.title);
  const [description, setDescription] = useState(storyboard.description ?? "");
  const [status, setStatus] = useState(storyboard.status);
  const [, startTransition] = useTransition();

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link href="/storyboards" className="text-sm text-foreground/60 hover:underline">
            ← Storyboards
          </Link>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title !== storyboard.title) startTransition(() => void renameStoryboard(storyboard.id, title));
            }}
            className="mt-1 w-full rounded bg-transparent text-2xl font-semibold tracking-tight outline-none hover:bg-hover focus:bg-hover"
          />
          {storyboard.deliverable && (
            <p className="mt-1 text-sm text-foreground/50">
              Linked to{" "}
              <Link href={`/projects/${storyboard.deliverable.projectId}`} className="hover:underline">
                {storyboard.deliverable.name}
              </Link>{" "}
              · {storyboard.deliverable.projectName}
            </p>
          )}
        </div>
        <ThemeSwitcher />
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-foreground/60">Status</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              startTransition(() => void setStoryboardStatus(storyboard.id, e.target.value));
            }}
            className="rounded-md border border-border-strong bg-transparent px-2 py-1 text-sm outline-none"
          >
            {STORYBOARD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STORYBOARD_STATUS_LABEL[s as StoryboardStatus]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => updateStoryboardDescription(storyboard.id, description)}
        placeholder="Add a storyboard description…"
        rows={2}
        className="mt-4 w-full resize-none rounded-md border border-border-strong bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/60"
      />

      <ScreensSection storyboardId={storyboard.id} initial={initialScreens} />

      <div className="mt-10 border-t border-border pt-4">
        <form
          action={async () => {
            if (confirm("Delete this entire storyboard?")) await deleteStoryboard(storyboard.id);
          }}
        >
          <button className="text-sm text-red-600 hover:underline">Delete storyboard</button>
        </form>
      </div>
    </div>
  );
}
