"use client";

import * as React from "react";
import { Plus, Columns3, FolderKanban, Film, MonitorPlay, Shapes, type LucideIcon } from "lucide-react";

import { createBoard } from "@/app/actions/boards";
import { createProject } from "@/app/actions/projects";
import { createStoryboard } from "@/app/actions/storyboards";
import { createCourse } from "@/app/actions/courses";
import { createWhiteboard } from "@/app/actions/whiteboards";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Kind = {
  key: string;
  label: string;
  icon: LucideIcon;
  field: string;
  placeholder: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (formData: FormData) => Promise<any>;
};

const KINDS: Kind[] = [
  { key: "board", label: "Board", icon: Columns3, field: "name", placeholder: "Board name…", action: createBoard },
  { key: "project", label: "Project", icon: FolderKanban, field: "name", placeholder: "Project name…", action: createProject },
  { key: "storyboard", label: "Storyboard", icon: Film, field: "title", placeholder: "Storyboard title…", action: createStoryboard },
  { key: "course", label: "Course", icon: MonitorPlay, field: "title", placeholder: "Course title…", action: createCourse },
  { key: "whiteboard", label: "Whiteboard", icon: Shapes, field: "title", placeholder: "Whiteboard title…", action: createWhiteboard },
];

export function QuickCreate() {
  const [active, setActive] = React.useState<Kind | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="size-4" /> New
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {KINDS.map((k) => (
            <DropdownMenuItem key={k.key} onSelect={() => setActive(k)} className="cursor-pointer">
              <k.icon className="size-4 text-muted-foreground" /> {k.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent showCloseButton={false} className="top-1/3 max-w-sm rounded-xl bg-surface p-5 shadow-2xl">
          {active && (
            <>
              <DialogTitle className="mb-3 flex items-center gap-2 text-sm font-medium">
                <active.icon className="size-4 text-accent" /> New {active.label.toLowerCase()}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Create a new {active.label.toLowerCase()} and jump straight to it.
              </DialogDescription>
              <form action={active.action} className="flex flex-col gap-3">
                <Input name={active.field} required autoFocus maxLength={200} placeholder={active.placeholder} />
                {active.key === "board" && (
                  <Input
                    name="cardKeyPrefix"
                    maxLength={8}
                    placeholder="Card prefix (optional, e.g. WP)"
                    className="uppercase placeholder:normal-case"
                  />
                )}
                {active.key === "project" && (
                  <input type="hidden" name="methodology" value="ADDIE" />
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setActive(null)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create</Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
