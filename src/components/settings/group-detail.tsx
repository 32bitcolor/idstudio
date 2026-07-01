"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Trash2, UserPlus, X } from "lucide-react";
import { renameGroup, deleteGroup, addGroupMember, removeGroupMember } from "@/app/actions/groups";
import { setGroupResourceAccess } from "@/app/actions/access";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared/page";

type Person = { id: string; email: string; name: string | null };
type Resource = { id: string; name: string; granted: boolean };
type Resources = { board: Resource[]; storyboard: Resource[]; project: Resource[] };

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:border-ring";

export function GroupDetail({
  group,
  members,
  candidates,
  resources,
}: {
  group: { id: string; name: string; description: string | null };
  members: Person[];
  candidates: Person[];
  resources: Resources;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [pick, setPick] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function saveMeta() {
    if (name.trim() === group.name && (description.trim() || null) === (group.description ?? null)) return;
    setErr(null);
    startTransition(async () => {
      const res = await renameGroup(group.id, name, description.trim() || null);
      if (res?.error) setErr(res.error);
    });
  }

  function doDelete() {
    if (!confirm(`Delete the group "${group.name}"? Members and its resource-sharing are removed.`)) return;
    startTransition(async () => {
      const res = await deleteGroup(group.id);
      if (res?.error) setErr(res.error);
      else router.push("/settings/groups");
    });
  }

  function add() {
    if (!pick) return;
    setErr(null);
    startTransition(async () => {
      const res = await addGroupMember(group.id, pick);
      if (res?.error) setErr(res.error);
      else setPick("");
    });
  }

  function remove(userId: string) {
    setErr(null);
    startTransition(() => void removeGroupMember(group.id, userId));
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/settings/groups" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All groups
      </Link>

      <Card className="p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Group name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveMeta} className="max-w-md" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Description</span>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} onBlur={saveMeta} placeholder="Optional" className="max-w-md" />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div>
            <Button variant="ghost" size="sm" onClick={doDelete} disabled={pending} className="text-destructive hover:text-destructive">
              <Trash2 className="size-4" /> Delete group
            </Button>
          </div>
        </div>
      </Card>

      <div>
        <SectionHeader>Members · {members.length}</SectionHeader>
        <Card className="divide-y divide-border p-0">
          {members.length === 0 && (
            <p className="px-5 py-4 text-sm text-muted-foreground">No members yet. Add people below.</p>
          )}
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{m.name ?? m.email}</div>
                <div className="truncate text-sm text-muted-foreground">{m.email}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => remove(m.id)} disabled={pending} aria-label="Remove from group">
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </Card>

        {candidates.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <select value={pick} onChange={(e) => setPick(e.target.value)} className={selectClass}>
              <option value="">Add a member…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name ? `${c.name} (${c.email})` : c.email}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={add} disabled={pending || !pick}>
              <UserPlus className="size-4" /> Add
            </Button>
          </div>
        )}
      </div>

      <div>
        <SectionHeader>Shared resources</SectionHeader>
        <p className="mb-3 text-sm text-muted-foreground">
          Check a resource to give this group access. A resource shared with any group is
          restricted to its groups (and admins); anything left unchecked by every group stays
          visible to all members.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <ResourceColumn groupId={group.id} kind="board" title="Boards" items={resources.board} />
          <ResourceColumn groupId={group.id} kind="storyboard" title="Storyboards" items={resources.storyboard} />
          <ResourceColumn groupId={group.id} kind="project" title="Projects" items={resources.project} />
        </div>
      </div>
    </div>
  );
}

function ResourceColumn({
  groupId,
  kind,
  title,
  items,
}: {
  groupId: string;
  kind: "board" | "storyboard" | "project";
  title: string;
  items: Resource[];
}) {
  return (
    <Card className="p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">None yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((r) => (
            <ResourceToggle key={r.id} groupId={groupId} kind={kind} resource={r} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ResourceToggle({
  groupId,
  kind,
  resource,
}: {
  groupId: string;
  kind: "board" | "storyboard" | "project";
  resource: Resource;
}) {
  const [granted, setGranted] = useState(resource.granted);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    setGranted(next);
    startTransition(async () => {
      const res = await setGroupResourceAccess(groupId, kind, resource.id, next);
      if (res?.error) setGranted(!next); // revert on failure
    });
  }

  return (
    <li>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={granted}
          disabled={pending}
          onChange={(e) => toggle(e.target.checked)}
          className="size-4"
        />
        <span className="truncate">{resource.name}</span>
      </label>
    </li>
  );
}
