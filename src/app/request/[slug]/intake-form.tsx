"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitIntakeRequest } from "@/app/actions/intake";

export function IntakeForm({ workspaceId, workspaceName }: { workspaceId: string; workspaceName: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await submitIntakeRequest(workspaceId, formData);
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setTicket(result.ticket || "received");
  }

  if (ticket) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <CheckCircle2 className="size-9 text-success" />
        <h2 className="font-medium">Thanks — your request is in</h2>
        <p className="text-sm text-muted-foreground">
          {ticket !== "received" && (
            <>
              Reference: <span className="font-mono">{ticket}</span>. {" "}
            </>
          )}
          The {workspaceName} team will be in touch.
        </p>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Submit a request for training or content, and the {workspaceName} team will review it.
      </p>

      {/* Honeypot — invisible to real users, a magnet for naive bots. */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" required maxLength={140} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Your email</Label>
          <Input id="email" name="email" type="email" required maxLength={200} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">What do you need?</Label>
        <Input id="title" name="title" required maxLength={140} placeholder="e.g. New hire safety training" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Tell us more</Label>
        <Textarea id="description" name="description" required maxLength={4000} rows={5} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="targetAudience">Audience (optional)</Label>
          <Input id="targetAudience" name="targetAudience" maxLength={280} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="targetDate">Needed by (optional)</Label>
          <Input id="targetDate" name="targetDate" type="date" />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "Submitting…" : "Submit request"}
      </Button>
    </form>
  );
}
