"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Plug, Plus } from "lucide-react";
import { createApiToken, revokeApiToken } from "@/app/actions/api-tokens";
import { ListPanel, SectionHeader } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ConnectionRow = {
  id: string;
  name: string;
  kind: "oauth" | "personal";
  access: string;
  prefix: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  /** Someone else's (shown to admins); null when it's yours. */
  owner: string | null;
};

function ago(iso: string | null) {
  if (!iso) return "never";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return "just now";
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      {done ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      {done ? "Copied" : label}
    </Button>
  );
}

function Code({ children }: { children: string }) {
  return <code className="block overflow-x-auto whitespace-pre rounded-md bg-muted px-3 py-2 font-mono text-xs">{children}</code>;
}

export function AiSettings({
  mcpUrl,
  workspaceName,
  mine,
  others,
}: {
  mcpUrl: string;
  workspaceName: string;
  mine: ConnectionRow[];
  others: ConnectionRow[] | null;
}) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionHeader>Connect an AI assistant</SectionHeader>
        <p className="mb-3 max-w-2xl text-sm text-muted-foreground">
          IDStudio is an MCP server. Claude and other assistants that speak MCP can look things up and do work in{" "}
          <span className="font-medium text-foreground">{workspaceName}</span> as you: read projects, boards, storyboards and reviews, create
          and update cards, draft screens, answer review comments and more. They see only what you can see.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-md bg-muted px-3 py-1.5 font-mono text-sm">{mcpUrl}</code>
          <CopyButton text={mcpUrl} label="Copy URL" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface p-4 text-sm">
            <h3 className="mb-1 flex items-center gap-1.5 font-semibold">
              <Plug className="size-4" aria-hidden="true" /> Claude.ai or Claude Desktop
            </h3>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>
                <span className="text-foreground">Settings → Connectors → Add custom connector</span>.
              </li>
              <li>Paste the URL above and add it.</li>
              <li>Click Connect, sign in here, then pick the workspace and access.</li>
            </ol>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4 text-sm">
            <h3 className="mb-1 flex items-center gap-1.5 font-semibold">
              <KeyRound className="size-4" aria-hidden="true" /> Claude Code and other tools
            </h3>
            <p className="mb-2 text-muted-foreground">Sign in through the browser:</p>
            <Code>{`claude mcp add --transport http idstudio ${mcpUrl}`}</Code>
            <p className="my-2 text-muted-foreground">
              Then run <span className="font-mono text-foreground">/mcp</span> in Claude Code to sign in. Or use a personal token (below):
            </p>
            <Code>{`claude mcp add --transport http idstudio ${mcpUrl} \\\n  --header "Authorization: Bearer <token>"`}</Code>
          </div>
        </div>
      </section>

      <section>
        <SectionHeader
          action={
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden="true" /> New token
            </Button>
          }
        >
          Your connections
        </SectionHeader>
        <Connections rows={mine} empty="No connections yet. Connect Claude above, or create a personal token." />
      </section>

      {others && (
        <section>
          <SectionHeader>Everyone else&apos;s connections</SectionHeader>
          <p className="mb-3 text-sm text-muted-foreground">As an admin you can see and disconnect every connection in this workspace.</p>
          <Connections rows={others} empty="Nobody else has connected an assistant." />
        </section>
      )}

      {creating && <NewTokenDialog mcpUrl={mcpUrl} onClose={() => setCreating(false)} />}
    </div>
  );
}

function Connections({ rows, empty }: { rows: ConnectionRow[]; empty: string }) {
  const [error, setError] = useState<string | null>(null);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <>
      <ListPanel>
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.name}</span>
                <StatusBadge tone={r.kind === "oauth" ? "info" : "neutral"}>{r.kind === "oauth" ? "Connected app" : "Personal token"}</StatusBadge>
                <span className={cn("text-xs", r.access === "Read only" ? "text-muted-foreground" : "text-foreground")}>{r.access}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {r.owner && <>{r.owner} · </>}
                {r.prefix && <span className="font-mono">{r.prefix}…</span>}
                {r.prefix && " · "}
                created {ago(r.createdAt)} · last used {ago(r.lastUsedAt)}
                {r.expiresAt && <> · expires {new Date(r.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</>}
              </p>
            </div>
            <ConfirmDelete
              title={r.kind === "oauth" ? `Disconnect ${r.name}?` : `Revoke "${r.name}"?`}
              description="It stops working immediately. You can always connect again."
              confirmLabel={r.kind === "oauth" ? "Disconnect" : "Revoke"}
              onConfirm={async () => {
                const res = await revokeApiToken(r.id);
                if (res?.error) setError(res.error);
              }}
              trigger={
                <Button size="sm" variant="ghost" className="text-destructive-ink hover:text-destructive-ink">
                  {r.kind === "oauth" ? "Disconnect" : "Revoke"}
                </Button>
              }
            />
          </li>
        ))}
      </ListPanel>
      {error && <p role="alert" className="mt-2 text-sm text-destructive-ink">{error}</p>}
    </>
  );
}

function NewTokenDialog({ mcpUrl, onClose }: { mcpUrl: string; onClose: () => void }) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"read" | "read write">("read write");
  const [expires, setExpires] = useState<"30" | "90" | "365" | "never">("90");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createApiToken({ name, scope, expiresInDays: expires === "never" ? null : (Number(expires) as 30 | 90 | 365) });
      if ("error" in res && res.error) setError(res.error);
      else if ("token" in res && res.token) setToken(res.token);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{token ? "Copy your token now" : "New personal token"}</DialogTitle>
          <DialogDescription>
            {token
              ? "This is the only time it's shown. Treat it like a password: anyone with it can act as you in this workspace."
              : "For assistants and scripts that take a bearer token. Claude.ai and Claude Desktop don't need one; they sign in."}
          </DialogDescription>
        </DialogHeader>
        {token ? (
          <div className="flex min-w-0 flex-col gap-3 text-sm">
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs">{token}</code>
              <CopyButton text={token} />
            </div>
            <p className="text-muted-foreground">Claude Code:</p>
            <Code>{`claude mcp add --transport http idstudio ${mcpUrl} \\\n  --header "Authorization: Bearer ${token}"`}</Code>
            <DialogFooter>
              <Button onClick={onClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              Name
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Claude Code on my laptop" maxLength={80} autoFocus />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Access
              <Select value={scope} onChange={(e) => setScope(e.target.value as "read" | "read write")}>
                <option value="read write">Read and change</option>
                <option value="read">Read only</option>
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Expires
              <Select value={expires} onChange={(e) => setExpires(e.target.value as typeof expires)}>
                <option value="30">In 30 days</option>
                <option value="90">In 90 days</option>
                <option value="365">In a year</option>
                <option value="never">Never</option>
              </Select>
            </label>
            {error && <p role="alert" className="text-sm text-destructive-ink">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !name.trim()}>
                {pending ? "Creating…" : "Create token"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
