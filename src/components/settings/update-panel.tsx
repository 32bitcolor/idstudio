"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, ArrowUpCircle, RotateCcw, GitCommitHorizontal, CircleAlert, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getUpdateStatus, checkForUpdates, applyUpdate, rollbackUpdate } from "@/app/actions/updates";
import type { UpdateStatus } from "@/lib/updater";

const UPDATE_STAGES = [
  { key: "pulling", label: "Pulling code" },
  { key: "building", label: "Building" },
  { key: "starting", label: "Starting" },
] as const;

// Segmented progress bar for the update/rollback pipeline. `stage` comes straight from
// the host agent (deploy/update-agent.sh) as it works through each step — an older
// agent that hasn't picked up this field yet just falls back to lighting up step 1.
function UpdateProgressBar({ stage }: { stage: string }) {
  const activeIndex = Math.max(
    0,
    UPDATE_STAGES.findIndex((s) => s.key === stage)
  );
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <div className="flex gap-1">
        {UPDATE_STAGES.map((s, i) => (
          <div key={s.key} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={
                "h-full rounded-full bg-info transition-all duration-500 " +
                (i < activeIndex ? "w-full" : i === activeIndex ? "w-full animate-pulse" : "w-0")
              }
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 text-xs">
        {UPDATE_STAGES.map((s, i) => (
          <span
            key={s.key}
            className={
              "flex items-center gap-1 " +
              (i < activeIndex ? "text-foreground" : i === activeIndex ? "font-medium text-info" : "text-muted-foreground")
            }
          >
            {i < activeIndex && <Check className="size-3" />}
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function UpdatePanel({ initial }: { initial: UpdateStatus | null }) {
  const [status, setStatus] = useState<UpdateStatus | null>(initial);
  const [reconnecting, setReconnecting] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [pending, setPending] = useState<null | "check" | "update" | "rollback">(null);
  const [expanded, setExpanded] = useState(false);

  // The commit we were on when the current update/rollback cycle started — used
  // with sawDisconnect below to tell "still building, old process still serving"
  // apart from "actually restarted," so we only reload once that's proven.
  const baselineCommit = useRef<string | null>(null);
  const sawDisconnect = useRef(false);
  const wasReconnecting = useRef(false);
  const reconnectingSince = useRef<number | null>(null);

  function beginTracking(commit: string | null | undefined) {
    baselineCommit.current = commit ?? null;
    sawDisconnect.current = false;
  }

  async function refresh() {
    try {
      const s = await getUpdateStatus();
      if (wasReconnecting.current) sawDisconnect.current = true;
      wasReconnecting.current = false;
      reconnectingSince.current = null;
      setReconnecting(false);
      setStatus(s);

      const midCycle = baselineCommit.current !== null;
      const settled = s?.state !== "updating" && s?.state !== "checking";
      // Either signal proves the restart actually happened: we saw the old process
      // go away, or the served commit itself moved (covers a rebuild fast/cached
      // enough that no poll ever landed during the brief outage).
      const proofOfRestart = sawDisconnect.current || (!!s?.currentCommit && s.currentCommit !== baselineCommit.current);
      if (midCycle && proofOfRestart && settled) {
        if (s?.state === "error") {
          // Build/restart failed but the old process is still serving — no reload needed.
          baselineCommit.current = null;
          sawDisconnect.current = false;
        } else {
          // Reconnected to a freshly restarted, idle app — safe to pull the new bundle.
          setReloading(true);
          setTimeout(() => window.location.reload(), 700);
        }
      }
    } catch {
      // app may be mid-restart during an update — keep trying, but only for as
      // long as a container restart plausibly takes. A failure that never clears
      // usually isn't "still restarting" — it's this exact tab's bundle hitting a
      // stale Server Action ID against the new server (the same class of problem
      // deploymentId protects navigation from, but polling calls don't go through
      // navigation, so they need their own bailout). No amount of retrying fixes
      // that; only a full reload, which always fetches current code, does.
      wasReconnecting.current = true;
      setReconnecting(true);
      const now = Date.now();
      if (reconnectingSince.current === null) {
        reconnectingSince.current = now;
      } else if (now - reconnectingSince.current > 20000) {
        window.location.reload();
      }
    }
  }

  // Keep the interval's callback fresh without tearing it down every render.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });

  useEffect(() => {
    // If we mount mid-update (e.g. the user manually refreshed while it was
    // running), pick tracking back up so the automatic reload still fires.
    if (initial?.state === "updating" || initial?.state === "checking") {
      beginTracking(initial.currentCommit);
    }
  }, [initial]);

  useEffect(() => {
    const busyNow = status?.state === "updating" || status?.state === "checking" || reconnecting || pending !== null;
    const id = setInterval(() => refreshRef.current(), busyNow ? 1500 : 5000);
    return () => clearInterval(id);
  }, [status?.state, reconnecting, pending]);

  // Browsers throttle (or fully suspend) setInterval in a backgrounded tab, so a
  // multi-minute rebuild can finish long before a hidden tab's next scheduled poll
  // would've fired — leaving a stale "waiting for the rebuild" message on screen
  // even though the update is long done. Force an immediate poll the moment the
  // tab regains focus/visibility so it catches up right away instead of waiting.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") refreshRef.current();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
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
  const busy = s?.state === "checking" || s?.state === "updating" || pending !== null || reloading;
  const updateAvailable = (s?.behind ?? 0) > 0;
  const canRollback = !!s?.previousCommit && s.previousCommit !== s.currentCommit;

  async function onCheck() {
    setPending("check");
    try {
      await checkForUpdates();
    } finally {
      refreshRef.current();
      setTimeout(() => setPending(null), 1500);
    }
  }
  async function onUpdate() {
    if (!confirm("Update IDStudio now? The app will rebuild and briefly restart. In-progress work should be saved first.")) return;
    setPending("update");
    beginTracking(s?.currentCommit);
    try {
      await applyUpdate();
    } finally {
      refreshRef.current();
      setTimeout(() => setPending(null), 3000);
    }
  }
  async function onRollback() {
    if (!confirm(`Roll back to ${s?.previousCommit}? The app will rebuild and restart.`)) return;
    setPending("rollback");
    beginTracking(s?.currentCommit);
    try {
      await rollbackUpdate();
    } finally {
      refreshRef.current();
      setTimeout(() => setPending(null), 3000);
    }
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

      {/* A failed fetch means the counts below came from the last successful check and
          may be arbitrarily old — say so, rather than presenting a stale number as
          current. This is the signal that was silently swallowed before. */}
      {s?.fetchError && (
        <section className="rounded-xl border border-warning/35 bg-warning/7 p-5">
          <h2 className="font-medium text-warning">Can&rsquo;t reach the update source</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The version info below is from the last successful check and may be out of
            date. Git reported:
          </p>
          <code className="mt-2 block overflow-x-auto rounded bg-muted px-2 py-1.5 text-xs">
            {s.fetchError}
          </code>
        </section>
      )}

      {updateAvailable && (
        <section className="rounded-xl border border-info/35 bg-info/7 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {(s?.pending?.length ?? 0) > 0 ? (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="flex items-center gap-1.5 font-medium text-info hover:underline"
                  aria-expanded={expanded}
                >
                  {s!.behind} update{s!.behind === 1 ? "" : "s"} available
                  <ChevronDown className={"size-4 transition-transform " + (expanded ? "rotate-180" : "")} />
                </button>
              ) : (
                <h2 className="font-medium text-info">
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

      {reloading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <RefreshCw className="size-3.5 shrink-0 animate-spin" />
          Update complete — reloading this page…
        </p>
      )}

      {!reloading && reconnecting && (
        <div className="rounded-xl border border-border p-4">
          <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="size-3.5 shrink-0 animate-spin" />
            Reconnecting — the app just restarted…
          </p>
          <UpdateProgressBar stage="starting" />
        </div>
      )}

      {!reloading && !reconnecting && (s?.state === "updating" || pending === "update" || pending === "rollback") && (
        <div className="rounded-xl border border-border p-4">
          <UpdateProgressBar stage={s?.state === "updating" ? s.stage : "pulling"} />
        </div>
      )}

      {!reloading && !reconnecting && (s?.state === "checking" || pending === "check") && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <RefreshCw className="size-3.5 shrink-0 animate-spin" />
          Checking for updates…
        </p>
      )}
      {!reconnecting && !reloading && s?.state === "error" && (
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
