"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "@/app/actions/auth";
import type { AuthState } from "@/lib/form-state";

const inputClass =
  "w-full rounded-md border border-border-strong bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/60";

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signup, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Your name" error={state?.fieldErrors?.name}>
        <input name="name" className={inputClass} placeholder="Jane Designer" autoComplete="name" />
      </Field>

      <Field label="Email" error={state?.fieldErrors?.email}>
        <input name="email" type="email" className={inputClass} placeholder="you@example.com" autoComplete="email" />
      </Field>

      <Field label="Password" error={state?.fieldErrors?.password}>
        <input name="password" type="password" className={inputClass} placeholder="At least 8 characters" autoComplete="new-password" />
      </Field>

      <Field label="Workspace name" error={state?.fieldErrors?.workspaceName}>
        <input name="workspaceName" className={inputClass} placeholder="e.g. Acme L&D Team" />
      </Field>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-sm text-foreground/60">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error?.[0] && <span className="text-xs text-red-600">{error[0]}</span>}
    </label>
  );
}
