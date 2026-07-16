"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpCircle } from "lucide-react";

import { getUpdateStatus } from "@/app/actions/updates";

/**
 * Admin-only header nudge when a self-update is available. The count is polled
 * live (server-rendered `initialCount` for first paint) so it doesn't go stale —
 * this lives in the shared app layout, which persists across client navigations,
 * so a static snapshot would freeze at whatever value the app first loaded with.
 */
export function UpdatePill({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const s = await getUpdateStatus();
      if (active && s) setCount(s.behind);
    };
    load();
    const id = setInterval(load, 60_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

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
