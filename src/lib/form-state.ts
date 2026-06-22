// Shared return shape for auth Server Actions consumed by useActionState.
// Kept out of the "use server" module so a plain type can be imported by Client Components.
export type AuthState =
  | { error?: string; fieldErrors?: Record<string, string[] | undefined> }
  | undefined;
