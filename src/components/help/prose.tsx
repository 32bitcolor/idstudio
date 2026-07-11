import * as React from "react";
import { Lightbulb, Info, TriangleAlert, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Content column for a help article. */
export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("max-w-2xl", className)}>{children}</div>;
}

/** The one-or-two-sentence intro under an article title. */
export function Lead({ children }: { children: React.ReactNode }) {
  return <p className="mb-8 text-lg leading-relaxed text-muted-foreground">{children}</p>;
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 mb-3 scroll-mt-24 text-xl font-semibold tracking-tight first:mt-0">
      {children}
    </h2>
  );
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 mb-2 text-base font-semibold tracking-tight">{children}</h3>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="my-3 leading-relaxed text-foreground/90">{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="my-3 ml-1 flex flex-col gap-2">{children}</ul>;
}

export function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 leading-relaxed text-foreground/90">
      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent/70" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/** Ordered, numbered how-to steps. */
export function Steps({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  return (
    <ol className="my-5 flex flex-col gap-4">
      {items.map((child, i) => (
        <li key={i} className="flex gap-3.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 pt-0.5 leading-relaxed text-foreground/90">{child}</div>
        </li>
      ))}
    </ol>
  );
}

const CALLOUT: Record<string, { icon: LucideIcon; var: string; label: string }> = {
  tip: { icon: Lightbulb, var: "--color-success", label: "Tip" },
  note: { icon: Info, var: "--color-info", label: "Note" },
  warning: { icon: TriangleAlert, var: "--color-warning", label: "Heads up" },
};

/** A tinted aside for tips, notes, and warnings — theme-safe via color-mix. */
export function Callout({
  tone = "note",
  title,
  children,
}: {
  tone?: "tip" | "note" | "warning";
  title?: string;
  children: React.ReactNode;
}) {
  const c = CALLOUT[tone];
  const Icon = c.icon;
  return (
    <div
      className="my-5 flex gap-3 rounded-xl border p-4"
      style={{
        borderColor: `color-mix(in srgb, var(${c.var}) 30%, transparent)`,
        backgroundColor: `color-mix(in srgb, var(${c.var}) 8%, transparent)`,
      }}
    >
      <Icon className="mt-0.5 size-4.5 shrink-0" style={{ color: `var(${c.var})` }} />
      <div className="min-w-0 text-sm leading-relaxed text-foreground/90">
        <span className="font-semibold" style={{ color: `var(${c.var})` }}>
          {title ?? c.label}.
        </span>{" "}
        {children}
      </div>
    </div>
  );
}

/** A term → definition grid, ideal for phase/status glossaries. */
export function DefList({ children }: { children: React.ReactNode }) {
  return <dl className="my-5 flex flex-col divide-y divide-border rounded-xl border border-border">{children}</dl>;
}

export function Def({ term, children }: { term: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 p-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="font-semibold text-foreground">{term}</dt>
      <dd className="text-sm leading-relaxed text-muted-foreground">{children}</dd>
    </div>
  );
}

/** Inline emphasis for a literal UI label the user should look for. */
export function UI({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[0.85em] font-medium text-foreground">
      {children}
    </span>
  );
}
