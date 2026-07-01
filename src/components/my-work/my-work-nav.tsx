"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/my-work", label: "Overview" },
  { href: "/my-work/history", label: "Review History" },
];

function isActive(pathname: string, href: string) {
  if (href === "/my-work") return pathname === "/my-work";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MyWorkNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-6 flex gap-1 border-b border-border">
      {TABS.map((t) => {
        const active = isActive(pathname, t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
