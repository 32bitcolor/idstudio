"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { Plus, Users2, ChevronRight } from "lucide-react";
import { createGroup } from "@/app/actions/groups";
import type { FormState } from "@/lib/form-state";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared/page";
import { EmptyState } from "@/components/shared/empty-state";

export type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  sharedCount: number;
};

export function GroupsManager({ groups }: { groups: GroupRow[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createGroup, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state?.success]);

  return (
    <div className="flex flex-col gap-8">
      <Card className="p-6">
        <h2 className="mb-4 font-medium">Create a group</h2>
        <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="Leadership" />
            {state?.fieldErrors?.name?.[0] && <span className="text-xs text-destructive">{state.fieldErrors.name[0]}</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Input id="description" name="description" placeholder="Managers & above" />
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              <Plus className="size-4" /> {pending ? "Creating…" : "Create group"}
            </Button>
            {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
            {state?.success && <span className="text-sm text-green-600">{state.success}</span>}
          </div>
        </form>
      </Card>

      <div>
        <SectionHeader>Groups · {groups.length}</SectionHeader>
        {groups.length === 0 ? (
          <EmptyState
            icon={Users2}
            title="No groups yet"
            description="Create a group, add members, then share specific boards, storyboards, or projects with it."
          />
        ) : (
          <Card className="divide-y divide-border p-0">
            {groups.map((g) => (
              <Link
                key={g.id}
                href={`/settings/groups/${g.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{g.name}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {g.description ? `${g.description} · ` : ""}
                    {g.memberCount} {g.memberCount === 1 ? "member" : "members"} ·{" "}
                    {g.sharedCount} shared {g.sharedCount === 1 ? "resource" : "resources"}
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
