import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * A lightweight styled wrapper over the native <select>. Keeps native
 * onChange semantics (drop-in for existing selects) while giving every
 * dropdown in the app one consistent, theme-aware look.
 */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  // The wrapper is full-width by default; a caller asking the select for `w-auto`
  // wants it sized to its content, so the wrapper must shrink too (otherwise every
  // inline `w-auto` dropdown silently stretched to a full row).
  const auto = /(^|\s)w-auto(\s|$)/.test(className ?? "")
  return (
    <div className={cn("relative inline-flex", auto ? "w-auto" : "w-full")}>
      <select
        data-slot="select"
        className={cn(
          "flex w-full appearance-none items-center rounded-md border border-input bg-transparent py-2 pl-3 pr-8 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

export { Select }
