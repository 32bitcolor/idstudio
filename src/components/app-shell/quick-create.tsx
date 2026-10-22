"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Columns3, FolderKanban, Film, Shapes, type LucideIcon } from "lucide-react";

import { createBoard } from "@/app/actions/boards";
import { createProject } from "@/app/actions/projects";
import { createStoryboard } from "@/app/actions/storyboards";
import { createWhiteboard } from "@/app/actions/whiteboards";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export type CreateKind = "board" | "project" | "storyboard" | "whiteboard";

type Kind = {
  key: CreateKind;
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
  { key: "whiteboard", label: "Whiteboard", icon: Shapes, field: "title", placeholder: "Whiteboard title…", action: createWhiteboard },
];

/** The header's "+ New" menu: pick a kind, then the shared create dialog. */
export function QuickCreate() {
  const [active, setActive] = React.useState<Kind | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="size-4" aria-hidden="true" /> <span className="sr-only sm:not-sr-only">New</span>
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

      <CreateDialog kind={active} onClose={() => setActive(null)} />
    </>
  );
}

/** A page-header primary action ("New project", …) opening the same create dialog —
 *  replaces the inline create forms that used to sit at the top of each list page. */
export function CreateButton({ kind }: { kind: CreateKind }) {
  const [open, setOpen] = React.useState(false);
  const k = KINDS.find((x) => x.key === kind)!;
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" />
        New {k.label.toLowerCase()}
      </Button>
      <CreateDialog kind={open ? k : null} onClose={() => setOpen(false)} />
    </>
  );
}

function CreateDialog({ kind, onClose }: { kind: Kind | null; onClose: () => void }) {
  return (
    <Dialog open={!!kind} onOpenChange={(v) => !v && onClose()}>
      <DialogContent showCloseButton={false} className="top-1/3 max-w-sm rounded-xl bg-surface p-5 shadow-2xl">
        {kind && (
          <>
            <DialogTitle className="mb-3 flex items-center gap-2 text-sm font-medium">
              <kind.icon className="size-4 text-accent" aria-hidden="true" /> New {kind.label.toLowerCase()}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Create a new {kind.label.toLowerCase()} and jump straight to it.
            </DialogDescription>
            <form action={kind.action} className="flex flex-col gap-3">
              <Input
                name={kind.field}
                required
                autoFocus
                maxLength={200}
                placeholder={kind.placeholder}
                aria-label={`${kind.label} name`}
              />
              {kind.key === "board" && (
                <Input
                  name="cardKeyPrefix"
                  maxLength={8}
                  placeholder="Card prefix (optional, e.g. WP)"
                  aria-label="Card prefix (optional)"
                  className="uppercase placeholder:normal-case"
                />
              )}
              {kind.key === "project" && (
                <div className="flex flex-col gap-1.5">
                  <Select name="methodology" defaultValue="ADDIE" aria-label="Methodology">
                    <option value="ADDIE">ADDIE</option>
                    <option value="SAM">SAM</option>
                    <option value="CUSTOM">Custom (start empty)</option>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Not sure?{" "}
                    <Link href="/help/addie-sam" onClick={onClose} className="font-medium text-foreground underline underline-offset-2">
                      Compare ADDIE &amp; SAM
                    </Link>{" "}
                    — Tavoro seeds the matching phases.
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit">Create</Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
