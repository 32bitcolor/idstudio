"use client";

import { useState } from "react";
import { Mail, CheckCircle2, AlertCircle } from "lucide-react";

import { sendTestEmail } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NotificationsPanel({
  configured,
  defaultTo,
}: {
  configured: boolean;
  defaultTo: string;
}) {
  const [to, setTo] = useState(defaultTo);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    setPending(true);
    setResult(null);
    const res = await sendTestEmail(to);
    setPending(false);
    if ("error" in res && res.error) setResult({ ok: false, text: res.error });
    else if ("success" in res && res.success) setResult({ ok: true, text: res.success });
  }

  return (
    <div className="max-w-xl">
      <div className="rounded-xl border border-border p-5">
        <div className="flex items-center gap-2">
          <Mail className="size-5 text-muted-foreground" />
          <h2 className="font-medium">Email notifications</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          IDStudio emails people on intake activity, review requests, and subtask assignments.
          Delivery goes through your configured SMTP provider (set the <code className="rounded bg-muted px-1 py-0.5 text-xs">SMTP_*</code> environment
          variables on the server).
        </p>

        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Status:</span>
          {configured ? (
            <span className="inline-flex items-center gap-1 font-medium text-success">
              <CheckCircle2 className="size-4" /> SMTP configured
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-medium text-destructive">
              <AlertCircle className="size-4" /> Not configured
            </span>
          )}
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <label htmlFor="test-to" className="text-sm font-medium">Send a test email</label>
          <p className="mb-2 text-xs text-muted-foreground">
            Sends a message right now so you can confirm delivery. Errors from the provider (e.g. an
            unverified sending domain) are shown here.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="test-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="you@example.com"
              className="w-full sm:w-72"
            />
            <Button onClick={send} disabled={pending || !configured}>
              {pending ? "Sending…" : "Send test email"}
            </Button>
          </div>
          {result && (
            <p role="alert" className={`mt-2 text-sm ${result.ok ? "text-success" : "text-destructive"}`}>
              {result.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
