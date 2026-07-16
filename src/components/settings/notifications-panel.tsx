"use client";

import { useState } from "react";
import { Mail, CheckCircle2, AlertCircle } from "lucide-react";

import { sendTestEmail, setNotificationEnabled } from "@/app/actions/notifications";
import { NOTIFICATION_TYPES, type NotificationType } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PrefMap = Record<NotificationType, boolean>;

const ALL_ON = Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t.key, true])) as PrefMap;

export function NotificationsPanel({
  configured,
  defaultTo,
  settings,
}: {
  configured: boolean;
  defaultTo: string;
  settings?: PrefMap;
}) {
  const [to, setTo] = useState(defaultTo);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const [prefs, setPrefs] = useState<PrefMap>(settings ?? ALL_ON);
  const [saving, setSaving] = useState<NotificationType | null>(null);

  async function send() {
    setPending(true);
    setResult(null);
    const res = await sendTestEmail(to);
    setPending(false);
    if ("error" in res && res.error) setResult({ ok: false, text: res.error });
    else if ("success" in res && res.success) setResult({ ok: true, text: res.success });
  }

  async function toggle(type: NotificationType) {
    const next = !prefs[type];
    setPrefs((p) => ({ ...p, [type]: next })); // optimistic
    setSaving(type);
    const res = await setNotificationEnabled(type, next);
    setSaving(null);
    if (res && "error" in res) setPrefs((p) => ({ ...p, [type]: !next })); // revert on failure
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-xl border border-border p-5">
        <div className="flex items-center gap-2">
          <Mail className="size-5 text-muted-foreground" />
          <h2 className="font-medium">Email notifications</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          IDStudio emails people on activity like assignments, comments, reviews, and status
          changes. Delivery goes through your configured SMTP provider (set the{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">SMTP_*</code> environment variables
          on the server).
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

      <div className="rounded-xl border border-border p-5">
        <h2 className="font-medium">What sends an email</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Turn individual notification types on or off for this workspace. Changes apply to
          everyone. People are never emailed about their own actions.
        </p>

        <ul className="mt-4 divide-y divide-border">
          {NOTIFICATION_TYPES.map((t) => (
            <li key={t.key} className="flex items-start justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[t.key]}
                aria-label={`${prefs[t.key] ? "Disable" : "Enable"} ${t.label} emails`}
                disabled={saving === t.key}
                onClick={() => toggle(t.key)}
                className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${
                  prefs[t.key] ? "bg-primary" : "bg-input"
                }`}
              >
                <span
                  className={`inline-block size-4 transform rounded-full bg-white shadow transition-transform ${
                    prefs[t.key] ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
