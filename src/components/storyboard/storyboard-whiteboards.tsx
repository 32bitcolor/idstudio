"use client";

import Link from "next/link";
import { Plus, Shapes } from "lucide-react";
import { createWhiteboardForStoryboard } from "@/app/actions/whiteboards";
import { SectionHeader } from "@/components/shared/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type LinkedWhiteboard = { id: string; title: string };

export function StoryboardWhiteboards({
  storyboardId,
  whiteboards,
}: {
  storyboardId: string;
  whiteboards: LinkedWhiteboard[];
}) {
  return (
    <section className="mt-8">
      <SectionHeader
        action={
          <form action={createWhiteboardForStoryboard.bind(null, storyboardId)}>
            <Button type="submit" variant="outline" size="sm">
              <Plus className="size-4" /> New whiteboard
            </Button>
          </form>
        }
      >
        Whiteboards
      </SectionHeader>

      {whiteboards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No whiteboards yet. Sketch a workflow or wireframe tied to this storyboard.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {whiteboards.map((w) => (
            <li key={w.id}>
              <Link href={`/whiteboards/${w.id}`} className="group block">
                <Card className="px-4 py-3 transition-colors group-hover:border-border-strong">
                  <div className="flex items-center gap-3">
                    <Shapes className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">{w.title}</span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
