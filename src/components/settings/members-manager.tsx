"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { KeyRound, Trash2, UserPlus } from "lucide-react";
import { createUser, setUserRole, resetUserPassword, removeUser } from "@/app/actions/members";
import type { FormState } from "@/lib/form-state";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared/page";

export type Member = { id: string; email: string; name: string | null; role: string; isSelf: boolean };

const selectClass =
  "h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:border-ring";

export function MembersManager({ members }: { members: Member[] }) {
  return (
    <div className="flex flex-col gap-8">
      <CreateUser />
      <div>
        <SectionHeader>Members · {members.length}</SectionHeader>
        <Card className="divide-y divide-border p-0">
          {members.map((m) => (
            <MemberRow key={m.id} member={m} />
          ))}
        </Card>
      </div>
    </div>
  );
}

function CreateUser() {
  const [state, action, pending] = useActionState<FormState, FormData>(createUser, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state?.success]);

  return (
    <Card className="p-6">
      <h2 className="mb-4 font-medium">Add a member</h2>
      <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" placeholder="Alex Chen" />
          {state?.fieldErrors?.name?.[0] && <span className="text-xs text-destructive">{state.fieldErrors.name[0]}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="alex@company.com" autoComplete="off" />
          {state?.fieldErrors?.email?.[0] && <span className="text-xs text-destructive">{state.fieldErrors.email[0]}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Initial password</Label>
          <Input id="password" name="password" type="text" placeholder="Share this securely" autoComplete="off" />
          {state?.fieldErrors?.password?.[0] && <span className="text-xs text-destructive">{state.fieldErrors.password[0]}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="role">Role</Label>
          <select id="role" name="role" defaultValue="MEMBER" className={selectClass}>
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            <UserPlus className="size-4" /> {pending ? "Adding…" : "Add member"}
          </Button>
          {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
          {state?.success && <span className="text-sm text-green-600">{state.success}</span>}
        </div>
      </form>
    </Card>
  );
}

function MemberRow({ member }: { member: Member }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [showReset, setShowReset] = useState(false);
  const [pw, setPw] = useState("");

  function changeRole(role: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await setUserRole(member.id, role);
      if (res?.error) setMsg({ kind: "err", text: res.error });
    });
  }

  function doReset() {
    setMsg(null);
    startTransition(async () => {
      const res = await resetUserPassword(member.id, pw);
      if (res?.error) setMsg({ kind: "err", text: res.error });
      else if (res?.fieldErrors?.password?.[0]) setMsg({ kind: "err", text: res.fieldErrors.password[0] });
      else if (res?.success) { setMsg({ kind: "ok", text: res.success }); setShowReset(false); setPw(""); }
    });
  }

  function doRemove() {
    if (!confirm(`Remove ${member.name ?? member.email} from the workspace?`)) return;
    setMsg(null);
    startTransition(async () => {
      const res = await removeUser(member.id);
      if (res?.error) setMsg({ kind: "err", text: res.error });
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{member.name ?? member.email}</span>
          {member.isSelf && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">You</span>}
        </div>
        <div className="truncate text-sm text-muted-foreground">{member.email}</div>
        {msg && <div className={msg.kind === "ok" ? "mt-1 text-xs text-green-600" : "mt-1 text-xs text-destructive"}>{msg.text}</div>}
      </div>

      <select
        value={member.role}
        onChange={(e) => changeRole(e.target.value)}
        disabled={pending}
        className={selectClass}
        aria-label="Role"
      >
        <option value="MEMBER">Member</option>
        <option value="ADMIN">Admin</option>
      </select>

      <Button variant="outline" size="sm" onClick={() => setShowReset((s) => !s)} disabled={pending}>
        <KeyRound className="size-4" /> Reset password
      </Button>
      {!member.isSelf && (
        <Button variant="ghost" size="sm" onClick={doRemove} disabled={pending} className="text-destructive hover:text-destructive">
          <Trash2 className="size-4" />
        </Button>
      )}

      {showReset && (
        <div className="flex w-full items-center gap-2 pt-1">
          <Input
            type="text"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="New password (min 8 chars)"
            className="max-w-xs"
            autoComplete="off"
          />
          <Button size="sm" onClick={doReset} disabled={pending || pw.length < 1}>Set password</Button>
          <Button size="sm" variant="ghost" onClick={() => { setShowReset(false); setPw(""); }}>Cancel</Button>
        </div>
      )}
    </div>
  );
}
