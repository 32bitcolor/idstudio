"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, ArrowUpCircle, RotateCcw, GitCommitHorizontal, CircleAlert, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getUpdateStatus, checkForUpdates, applyUpdate, rollbackUpdate } from "@/app/actions/updates";
import type { UpdateStatus } from "@/lib/updater";

export function UpdatePanel({ initial }: { initial: UpdateStatus | null }) {
  const [status, setStatus] = useState<UpdateStatus | null>(initial);
  const [reconnecting, setReconnecting] = useState(false);
  const [pending, setPending] = useState<null | "check" | "update" | "rollback">(null);
  const [expanded, setExpanded] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refresh() {
    try {
      const s = await getUpdateStatus();
      setStatus(s);
      setReconnecting(false);
    } catch {
      // app may be mid-restart during an update — keep trying
      setReconnecting(true);
    }
  }

  useEffect(() => {
    poll.current = setInterval(refresh, 4000);
    return () => { if (poll.current) clearInterval(poll.current); };
  }, []);

  if (!initial && !status) {
    return (
      <div className="max-w-2xl rounded-xl border border-border p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <CircleAlert className="size-4.5" />
          </div>
          <div>
            <h2 className="font-medium">In-app updates aren&rsquo;t configured</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This IDStudio install doesn&rsquo;t have the self-update agent running. Install it on the
              host with <code className="rounded bg-muted px-1">deploy/idstudio-updater.service</code>{" "}
              and redeploy so the app and agent share the control directory.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const s = status;
  const busy = s?.state === "checking" || s?.state === "updating" || pending !== null;
  const updateAvailable = (s?.behind ?? 0) > 0;
  const canRollback = !!s?.previousCommit && s.previousCommit !== s.currentCommit;

  async function onCheck() {
    setPending("check");
    await checkForUpdates();
    setTimeout(() => setPending(null), 1500);
  }
  async function onUpdate() {
    if (!confirm("Update IDStudio now? The app will rebuild and briefly restart. In-progress work should be saved first.")) return;
    setPending("update");
    await applyUpdate();
    setReconnecting(true);
    setTimeout(() => setPending(null), 3000);
  }
  async function onRollback() {
    if (!confirm(`Roll back to ${s?.previousCommit}? The app will rebuild and restart.`)) return;
    setPending("rollback");
    await rollbackUpdate();
    setReconnecting(true);
    setTimeout(() => setPending(null), 3000);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <section className="rounded-xl border border-border p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-medium">Current version</h2>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <GitCommitHorizontal className="size-4 text-muted-foreground" />
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{s?.currentCommit || "—"}</code>
              <span className="truncate text-muted-foreground">{s?.currentMessage}</span>
            </div>
            {s?.currentDate && (
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(s.currentDate).toLocaleString()}
              </p>
            )}
          </div>
          <Button variant="outline" onClick={onCheck} disabled={busy}>
            <RefreshCw className={"size-4 " + (s?.state === "checking" ? "animate-spin" : "")} />
            Check for updates
          </Button>
        </div>

        {s?.lastChecked && (
          <p className="mt-3 text-xs text-muted-foreground">
            Last checked {new Date(s.lastChecked).toLocaleString()}
            {s.lastResult ? ` · ${s.lastResult}` : ""}
          </p>
        )}
      </section>

      {updateAvailable && (
        <section className="rounded-xl border p-5" style={{ borderColor: "color-mix(in srgb, var(--color-info) 35%, transparent)", backgroundColor: "color-mix(in srgb, var(--color-info) 7%, transparent)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {(s?.pending?.length ?? 0) > 0 ? (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="flex items-center gap-1.5 font-medium hover:underline"
                  style={{ color: "var(--color-info)" }}
                  aria-expanded={expanded}
                >
                  {s!.behind} update{s!.behind === 1 ? "" : "s"} available
                  <ChevronDown className={"size-4 transition-transform " + (expanded ? "rotate-180" : "")} />
                </button>
              ) : (
                <h2 className="font-medium" style={{ color: "var(--color-info)" }}>
                  {s!.behind} update{s!.behind === 1 ? "" : "s"} available
                </h2>
              )}
              {!expanded && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{s!.latestCommit}</code>
                  <span className="truncate text-muted-foreground">{s!.latestMessage}</span>
                </div>
              )}
            </div>
            <Button onClick={onUpdate} disabled={busy}>
              <ArrowUpCircle className="size-4" /> Update now
            </Button>
          </div>

          {expanded && (s?.pending?.length ?? 0) > 0 && (
            <ul className="mt-4 flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
              {s!.pending.map((c) => (
                <li key={c.commit} className="flex items-start gap-3 p-3">
                  <code className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs">{c.commit}</code>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{c.subject}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {c.author}
                      {c.date ? ` · ${new Date(c.date).toLocaleString()}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {(s?.state === "updating" || reconnecting) && (
        <p className="text-sm text-muted-foreground">
          {reconnecting
            ? "Updating — the app is rebuilding and will restart. This page will reconnect automatically…"
            : "Working…"}
        </p>
      )}
      {s?.state === "error" && (
        <p className="text-sm text-destructive">{s.lastResult || "The last update failed."}</p>
      )}

      {canRollback && (
        <section className="rounded-xl border border-border p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-medium">Roll back</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Return to the previous version (<code className="rounded bg-muted px-1">{s!.previousCommit}</code>) if this update caused a problem.
              </p>
            </div>
            <Button variant="outline" onClick={onRollback} disabled={busy}>
              <RotateCcw className="size-4" /> Roll back
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
