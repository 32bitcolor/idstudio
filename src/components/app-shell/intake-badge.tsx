import Link from "next/link";
import { Inbox } from "lucide-react";

/** A quiet header link to Intake, with a count badge when requests need triage. */
export function IntakeBadge({ count }: { count: number }) {
  return (
    <Link
      href="/intake"
      className="relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
      title={count > 0 ? `${count} request${count === 1 ? "" : "s"} need${count === 1 ? "s" : ""} triage` : "Intake"}
    >
      <Inbox className="size-4" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
