"use client";

import { useState, useTransition } from "react";
import { Inbox, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setIntakeEnabled } from "@/app/actions/intake";

export function IntakeLinkPanel({ slug, intakeEnabled }: { slug: string; intakeEnabled: boolean }) {
  const [enabled, setEnabled] = useState(intakeEnabled);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const url = typeof window !== "undefined" ? `${window.location.origin}/request/${slug}` : `/request/${slug}`;

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setError(null);
    startTransition(async () => {
      const res = await setIntakeEnabled(next);
      if (res?.error) {
        setEnabled(!next);
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <section className="rounded-xl border border-border p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent">
            <Inbox className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-medium">Public intake link</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Anyone with this link can submit a request — no login required. Requests land in{" "}
              <strong>Intake</strong> for your team to triage.
            </p>

            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border border-border bg-muted px-3 py-2 text-sm">
                {url}
              </code>
              <Button variant="outline" size="sm" onClick={copy}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Button variant={enabled ? "outline" : "default"} size="sm" disabled={pending} onClick={toggle}>
                {enabled ? "Disable intake form" : "Enable intake form"}
              </Button>
              <span className="text-sm text-muted-foreground">
                {enabled ? "Accepting requests" : "Not accepting requests — link shows a not-found page"}
              </span>
            </div>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
