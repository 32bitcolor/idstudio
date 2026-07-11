"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { HELP_GROUPS, HELP_TOPICS } from "@/components/help/registry";

export function HelpNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-6">
      {HELP_GROUPS.map((group) => (
        <div key={group}>
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group}
          </p>
          <ul className="flex flex-col gap-0.5">
            {HELP_TOPICS.filter((t) => t.group === group).map((t) => {
              const href = `/help/${t.slug}`;
              const active = pathname === href;
              return (
                <li key={t.slug}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-accent/12 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-hover hover:text-foreground"
                    )}
                  >
                    <t.icon
                      className={cn("size-4 shrink-0", active ? "text-accent" : "text-muted-foreground")}
                    />
                    <span className="truncate">{t.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
