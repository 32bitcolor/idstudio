"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
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
          <button className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium transition-colors hover:border-border-strong hover:bg-hover">
            <Plus className="size-4" /> New
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {KINDS.map((k) => (
            <DropdownMenuItem key={k.key} onSelect={() => setActive(k)} className="cursor-pointer">
              <k.icon className="size-4 text-muted-foreground" /> {k.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogPrimitive.Root open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed top-1/3 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-5 shadow-2xl data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
            {active && (
              <>
                <DialogPrimitive.Title className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <active.icon className="size-4 text-accent" /> New {active.label.toLowerCase()}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">
                  Create a new {active.label.toLowerCase()} and jump straight to it.
                </DialogPrimitive.Description>
                <form action={active.action} className="flex flex-col gap-3">
                  <Input name={active.field} required autoFocus maxLength={200} placeholder={active.placeholder} />
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
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
