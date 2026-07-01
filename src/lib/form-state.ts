// Shared return shape for auth Server Actions consumed by useActionState.
// Kept out of the "use server" module so a plain type can be imported by Client Components.
export type AuthState =
  | { error?: string; fieldErrors?: Record<string, string[] | undefined> }
  | undefined;

// Like AuthState but also carries a success message (settings forms show inline
// confirmation rather than redirecting).
export type FormState =
  | {
      error?: string;
      fieldErrors?: Record<string, string[] | undefined>;
      success?: string;
    }
  | undefined;
