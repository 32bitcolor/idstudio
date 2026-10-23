import { cn } from "@/lib/utils";

// Small visual building blocks shared by every place a card ("work item") shows up:
// the board, its list view, the sprint board. One definition so a label, an avatar
// or a due date reads the same everywhere.

export type WorkLabel = { id: string; name: string; color: string };
export type WorkMember = { id: string; name: string | null; email: string };
export type StatusCategory = "todo" | "active" | "done" | null;

/** A label as a named pill with its colour as a dot — never colour alone (WCAG 1.4.1). */
export function LabelPill({ label }: { label: WorkLabel }) {
  return (
    <span className="inline-flex h-5 max-w-full items-center gap-1.5 rounded-full bg-muted px-2 text-[11px] font-semibold text-foreground/80">
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: label.color }} aria-hidden="true" />
      <span className="truncate">{label.name}</span>
    </span>
  );
}

export function initials(m: WorkMember) {
  const base = m.name?.trim() || m.email;
  const parts = base.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || base[0]?.toUpperCase();
}

/** 24px avatar; SMEs are tinted so they read apart from the people doing the work. */
export function Avatar({ member, sme }: { member: WorkMember; sme?: boolean }) {
  const name = member.name ?? member.email;
  return (
    <span
      className={cn(
        "flex size-6 items-center justify-center rounded-full border-2 border-surface text-[10px] font-semibold",
        // Opaque tint: in a stack the avatar underneath must not show through.
        sme ? "bg-[color-mix(in_srgb,var(--warning)_18%,var(--surface))] text-warning-ink" : "bg-accent text-accent-foreground",
      )}
      title={sme ? `SME: ${name}` : name}
    >
      <span aria-hidden="true">{initials(member)}</span>
      <span className="sr-only">{sme ? `SME: ${name}` : name}</span>
    </span>
  );
}

/** Assignees then SMEs, overlapped, capped so a busy card doesn't sprawl. */
export function AvatarStack({ assignees, smes = [] }: { assignees: WorkMember[]; smes?: WorkMember[] }) {
  if (assignees.length === 0 && smes.length === 0) return null;
  return (
    <span className="flex shrink-0 -space-x-1">
      {assignees.slice(0, 3).map((m) => (
        <Avatar key={"a" + m.id} member={m} />
      ))}
      {smes.slice(0, 2).map((m) => (
        <Avatar key={"s" + m.id} member={m} sme />
      ))}
    </span>
  );
}

export type DueTone = "overdue" | "soon" | "normal";

export function dueInfo(iso: string): { label: string; tone: DueTone } {
  // Due dates are calendar dates stored as UTC midnight — format/compare in UTC
  // so the displayed day doesn't shift with the viewer's timezone.
  const ymd = iso.slice(0, 10);
  const [y, m, day] = ymd.split("-").map(Number);
  const due = Date.UTC(y, m - 1, day);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((due - today) / 86_400_000);
  const date = new Date(due).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  if (days < 0) return { label: date, tone: "overdue" };
  if (days === 0) return { label: "Today", tone: "soon" };
  if (days === 1) return { label: "Tomorrow", tone: "soon" };
  return { label: date, tone: days <= 3 ? "soon" : "normal" };
}

const DUE_CHIP: Record<DueTone, string> = {
  overdue: "bg-destructive/10 text-destructive-ink",
  soon: "bg-warning/10 text-warning-ink",
  normal: "text-muted-foreground",
};

export function DueChip({ iso, className }: { iso: string; className?: string }) {
  const due = dueInfo(iso);
  return (
    <span className={cn("rounded px-1.5 py-0.5 whitespace-nowrap", DUE_CHIP[due.tone], className)}>
      <span className="sr-only">{due.tone === "overdue" ? "Overdue, due " : "Due "}</span>
      {due.label}
    </span>
  );
}

const CATEGORY_DOT: Record<string, string> = {
  todo: "bg-muted-foreground/60",
  active: "bg-info",
  done: "bg-success",
};

export function StatusDot({ category }: { category: StatusCategory }) {
  return (
    <span
      className={cn("size-2 shrink-0 rounded-full", category ? CATEGORY_DOT[category] : "bg-border-strong")}
      aria-hidden="true"
    />
  );
}
