"use client";

import { useState, useTransition } from "react";
import { Inbox, Copy, Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setIntakeEnabled, setIntakeSlug } from "@/app/actions/intake";

export function IntakeLinkPanel({
  slug: initialSlug,
  intakeEnabled,
  origin: appOrigin,
}: {
  slug: string;
  intakeEnabled: boolean;
  /** APP_URL without a trailing slash; empty when unset (then the browser's own origin). */
  origin: string;
}) {
  const [slug, setSlug] = useState(initialSlug);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialSlug);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [enabled, setEnabled] = useState(intakeEnabled);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [origin] = useState(() => appOrigin || (typeof window !== "undefined" ? window.location.origin : ""));
  const url = `${origin}/request/${slug}`;

  function saveSlug() {
    setSlugError(null);
    startTransition(async () => {
      const res = await setIntakeSlug(draft);
      if ("error" in res) {
        setSlugError(res.error);
        return;
      }
      setChanged(res.slug !== slug);
      setSlug(res.slug);
      setDraft(res.slug);
      setEditing(false);
    });
  }

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

            {editing ? (
              <form
                className="mt-3 flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveSlug();
                }}
              >
                <label htmlFor="intake-slug" className="text-sm font-medium">Link address</label>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="truncate text-sm text-muted-foreground">{origin}/request/</span>
                  <Input
                    id="intake-slug"
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                      setSlugError(null);
                    }}
                    maxLength={48}
                    autoFocus
                    aria-invalid={slugError ? true : undefined}
                    aria-describedby="intake-slug-help"
                    className="h-8 w-56"
                  />
                </div>
                <p id="intake-slug-help" className="text-xs text-muted-foreground">
                  Lowercase letters, numbers and hyphens. The current link keeps working and forwards to the new one.
                </p>
                {slugError && <p role="alert" className="text-sm text-destructive-ink">{slugError}</p>}
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={pending || !draft.trim()}>{pending ? "Saving…" : "Save link"}</Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(false);
                      setDraft(slug);
                      setSlugError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <div className="mt-3 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted px-3 py-2 text-sm">
                    {url}
                  </code>
                  <Button variant="outline" size="sm" onClick={copy}>
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                </div>
                {changed && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Link changed. The previous address forwards here, so links you&rsquo;ve already shared still work.
                  </p>
                )}
              </>
            )}

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
