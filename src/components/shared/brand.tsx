import { cn } from "@/lib/utils";

// The Tavoro brand: a workbench (a top and two legs, a stretcher between them) in a
// rounded square, and the lowercase wordmark set in Bricolage Grotesque. The mark
// takes the theme's accent, so it fits every theme.

export function TavoroMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 44 44"
      className={cn("size-8 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect width="44" height="44" rx="11" fill="var(--color-primary)" />
      <g fill="var(--color-primary-foreground)">
        <rect x="9" y="12" width="26" height="5" rx="2" />
        <rect x="13" y="17" width="4" height="15" rx="1.5" />
        <rect x="27" y="17" width="4" height="15" rx="1.5" />
        <rect x="13" y="25" width="18" height="3" rx="1.5" opacity="0.55" />
      </g>
    </svg>
  );
}

export function TavoroWordmark({ className }: { className?: string }) {
  return <span className={cn("font-brand font-bold tracking-tight", className)}>tavoro</span>;
}

/** Mark and wordmark side by side, for page headers outside the app shell. */
export function TavoroLogo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <TavoroMark className={markClassName} />
      <TavoroWordmark />
    </span>
  );
}
