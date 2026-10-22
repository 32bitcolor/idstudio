"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared/page";
import { disconnectAssistant, setWorkspaceAssistantEnabled } from "@/app/actions/assistant";

// Settings → AI & MCP: the in-app assistant (docs/ASSISTANT.md). Each member's own
// OpenRouter connection, and the admin's switch for the whole workspace.

export type AssistantConnectionInfo = {
  keyHint: string;
  model: string;
  connectedAt: string;
  usage: number | null;
  limitRemaining: number | null;
};

export function AssistantSettings({
  connection,
  enabled: initialEnabled,
  isAdmin,
}: {
  connection: AssistantConnectionInfo | null;
  enabled: boolean;
  isAdmin: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setError(null);
    startTransition(async () => {
      const res = await setWorkspaceAssistantEnabled(next);
      if (res?.error) {
        setEnabled(!next);
        setError(res.error);
      }
    });
  }

  return (
    <section>
      <SectionHeader>In-app assistant</SectionHeader>
      <div className="max-w-2xl rounded-xl border border-border p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-muted-foreground">
              The assistant button in the top bar opens a chat beside any page. It reads your workspace and, with your approval for every change, does the
              work. It runs on a model from your own OpenRouter account.
            </p>
            {!enabled ? (
              <p className="mt-3">Turned off for this workspace by an admin.</p>
            ) : connection ? (
              <div className="mt-3 flex flex-col gap-1">
                <p>
                  <span className="font-medium">Connected to OpenRouter</span>{" "}
                  <span className="text-muted-foreground">
                    · key ending <span className="font-mono">{connection.keyHint}</span> · since{" "}
                    {new Date(connection.connectedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Model: <span className="font-mono text-foreground">{connection.model}</span> (change it in the assistant panel)
                </p>
                {connection.usage !== null && (
                  <p className="text-muted-foreground">
                    Spent on this key: ${connection.usage.toFixed(2)}
                    {connection.limitRemaining !== null && ` · $${connection.limitRemaining.toFixed(2)} left of its limit`}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => startTransition(async () => void (await disconnectAssistant()))}
                  >
                    Disconnect
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Removes the key from Tavoro. Delete it in OpenRouter too (Settings → API keys) to retire it for good.
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-muted-foreground">
                Not connected. Open the assistant from the top bar and choose <span className="text-foreground">Sign in with OpenRouter</span>.
              </p>
            )}

            {isAdmin && (
              <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
                <Button variant={enabled ? "outline" : "default"} size="sm" disabled={pending} onClick={toggle}>
                  {enabled ? "Turn off for the workspace" : "Turn on for the workspace"}
                </Button>
                <span className="text-muted-foreground">
                  {enabled ? "Members can use the assistant with their own OpenRouter account." : "Nobody in this workspace can use the assistant."}
                </span>
              </div>
            )}
            {error && <p className="mt-2 text-destructive">{error}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
