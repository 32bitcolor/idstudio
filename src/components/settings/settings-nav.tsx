"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings/account", label: "Account", adminOnly: false },
  { href: "/settings/members", label: "Members", adminOnly: true },
  { href: "/settings/groups", label: "Groups", adminOnly: true },
  { href: "/settings/labels", label: "Labels", adminOnly: true },
  { href: "/settings/backup", label: "Backup", adminOnly: true },
  { href: "/settings/intake", label: "Intake", adminOnly: true },
  { href: "/settings/notifications", label: "Notifications", adminOnly: true },
  { href: "/settings/updates", label: "Updates", adminOnly: true },
];

export function SettingsNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-border">
      {TABS.filter((t) => !t.adminOnly || isAdmin).map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
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
