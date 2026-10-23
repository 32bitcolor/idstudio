"use client";

import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { resetIntakeStatusLink } from "@/app/actions/intake";
import { Button } from "@/components/ui/button";

/** The requester's status page link: copy it (to send by hand) or reset it if it went
 *  somewhere it shouldn't. Admins, managers and the assigned member. */
export function StatusLink({ requestId, url: initial }: { requestId: string; url: string }) {
  const [url, setUrl] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function reset() {
    setConfirm(false);
    startTransition(async () => {
      const res = await resetIntakeStatusLink(requestId);
      if ("error" in res) setNote(res.error);
      else {
        setUrl(res.url);
        setNote("New link made. The old one no longer works; send this one to the requester.");
      }
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
      <p className="text-xs font-medium text-muted-foreground">Their status page</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy link"}
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" /> View as requester
          </a>
        </Button>
        {confirm ? (
          <>
            <Button size="sm" variant="outline" disabled={pending} onClick={reset}>Reset link</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirm(true)}>Reset…</Button>
        )}
      </div>
      {confirm && <p className="text-xs text-muted-foreground">Resetting stops the current link working.</p>}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
