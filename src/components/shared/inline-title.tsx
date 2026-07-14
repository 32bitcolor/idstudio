"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Controlled inline-editable title used by every detail view. Parent owns the
 * value (so it can also feed the breadcrumb); this just standardizes the look,
 * the commit-on-blur/Enter behavior, and — importantly — an accessible name.
 */
export function InlineTitle({
  value,
  onChange,
  onCommit,
  ariaLabel,
  disabled,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      disabled={disabled}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={cn(
        "-mx-1 w-full rounded-md bg-transparent px-1 text-3xl font-semibold tracking-tight outline-none hover:bg-hover focus:bg-hover disabled:hover:bg-transparent",
        className
      )}
    />
  );
}
