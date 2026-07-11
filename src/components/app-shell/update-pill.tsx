import Link from "next/link";
import { ArrowUpCircle } from "lucide-react";

/** Admin-only header nudge when a self-update is available (Settings → Updates). */
export function UpdatePill({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Link
      href="/settings/updates"
      className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
      style={{
        borderColor: "color-mix(in srgb, var(--color-info) 35%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--color-info) 10%, transparent)",
        color: "var(--color-info)",
      }}
      title={`${count} update${count === 1 ? "" : "s"} available`}
    >
      <ArrowUpCircle className="size-4" />
      <span className="hidden sm:inline">
        {count} update{count === 1 ? "" : "s"}
      </span>
    </Link>
  );
}
