"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/app/actions/auth";
import type { AuthState } from "@/lib/form-state";

const inputClass =
  "w-full rounded-md border border-border-strong bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/60";

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Email</span>
        <input name="email" type="email" className={inputClass} placeholder="you@example.com" autoComplete="email" />
        {state?.fieldErrors?.email?.[0] && (
          <span className="text-xs text-red-600">{state.fieldErrors.email[0]}</span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Password</span>
        <input name="password" type="password" className={inputClass} autoComplete="current-password" />
        {state?.fieldErrors?.password?.[0] && (
          <span className="text-xs text-red-600">{state.fieldErrors.password[0]}</span>
        )}
      </label>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-center text-sm text-foreground/60">
        Need an account?{" "}
        <Link href="/signup" className="underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
