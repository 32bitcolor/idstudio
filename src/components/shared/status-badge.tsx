import * as React from "react";

import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_VAR: Record<Exclude<StatusTone, "neutral">, string> = {
  info: "--color-info",
  success: "--color-success",
  warning: "--color-warning",
  danger: "--color-destructive",
};
// Text uses the darker "ink" shade where the theme has one: the fill hues are too
// light for small text on their own tinted background.
const TONE_INK: Record<Exclude<StatusTone, "neutral">, string> = {
  info: "var(--color-info-ink)",
  success: "var(--color-success-ink)",
  warning: "var(--color-warning-ink)",
  danger: "var(--color-destructive-ink)",
};

/**
 * A theme-safe status chip. Colored tones derive a soft background from the
 * semantic token via color-mix, so they read correctly on every theme —
 * no more hard-coded text-red-600 / bg-green-500.
 */
export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  const base =
    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";
  if (tone === "neutral") {
    return <span className={cn(base, "bg-muted text-muted-foreground", className)}>{children}</span>;
  }
  const v = TONE_VAR[tone];
  return (
    <span
      className={cn(base, className)}
      style={{
        backgroundColor: `color-mix(in srgb, var(${v}) 14%, transparent)`,
        color: TONE_INK[tone],
      }}
    >
      {children}
    </span>
  );
}
