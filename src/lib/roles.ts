// Per-workspace role vocabulary + a distinct color per role for at-a-glance
// identification. Kept here so the same colors can be reused anywhere roles
// are shown (members list, workload view, etc.).
export const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  MEMBER: "Member",
};

/** A unique dot color per role, readable in both light and dark themes. */
export const ROLE_DOT: Record<string, string> = {
  ADMIN: "bg-violet-500",
  MANAGER: "bg-amber-500",
  MEMBER: "bg-sky-500",
};
