// Small shared helper for rendering due dates with urgency, used by the My Work
// hub (server sections and the client review inbox).

export type DueTone = "overdue" | "soon" | "normal";

export function dueMeta(due: Date | string | null | undefined): { label: string; tone: DueTone } | null {
  if (!due) return null;
  const d = typeof due === "string" ? new Date(due) : due;
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  const days = Math.round(ms / 86_400_000);
  if (ms < 0 && days !== 0) return { label: `${Math.abs(days)}d overdue`, tone: "overdue" };
  if (days === 0) return { label: "due today", tone: ms < 0 ? "overdue" : "soon" };
  return { label: `due in ${days}d`, tone: days <= 3 ? "soon" : "normal" };
}

export const dueToneClass: Record<DueTone, string> = {
  overdue: "text-destructive",
  soon: "text-amber-600",
  normal: "text-muted-foreground",
};
