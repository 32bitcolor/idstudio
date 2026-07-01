"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePassword } from "@/app/actions/account";
import type { FormState } from "@/lib/form-state";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function AccountForm({ email, name }: { email: string; name: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields after a successful change.
  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state?.success]);

  return (
    <div className="max-w-md">
      <Card className="p-6">
        <div className="mb-5">
          <h2 className="font-medium">Profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {name ? `${name} · ` : ""}
            {email}
          </p>
        </div>

        <form ref={formRef} action={action} className="flex flex-col gap-4">
          <h3 className="text-sm font-medium">Change password</h3>

          <Field
            label="Current password"
            name="currentPassword"
            autoComplete="current-password"
            error={state?.fieldErrors?.currentPassword?.[0]}
          />
          <Field
            label="New password"
            name="newPassword"
            autoComplete="new-password"
            error={state?.fieldErrors?.newPassword?.[0]}
          />
          <Field
            label="Confirm new password"
            name="confirmPassword"
            autoComplete="new-password"
            error={state?.fieldErrors?.confirmPassword?.[0]}
          />

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state?.success && <p className="text-sm text-green-600">{state.success}</p>}

          <Button type="submit" disabled={pending} className="mt-1 self-start">
            {pending ? "Saving…" : "Update password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Field({
  label,
  name,
  autoComplete,
  error,
}: {
  label: string;
  name: string;
  autoComplete?: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="password" autoComplete={autoComplete} />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
