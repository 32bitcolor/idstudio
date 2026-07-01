import * as React from "react";

import { cn } from "@/lib/utils";

/** One consistent content column for every page in the app shell. */
export function PageContainer({
  size = "default",
  className,
  children,
}: {
  size?: "default" | "wide" | "full";
  className?: string;
  children: React.ReactNode;
}) {
  const width = size === "full" ? "" : size === "wide" ? "max-w-6xl" : "max-w-5xl";
  return <div className={cn("mx-auto w-full px-4 py-8 sm:px-6", width, className)}>{children}</div>;
}

/** Page title block with optional eyebrow, description, and right-aligned actions. */
export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0 flex-1">
        {eyebrow ? <p className="text-sm text-muted-foreground">{eyebrow}</p> : null}
        {typeof title === "string" ? (
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        ) : (
          title
        )}
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Small uppercase section label (PHASES, DELIVERABLES, …) with optional action. */
export function SectionHeader({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {children}
      </h2>
      {action}
    </div>
  );
}
