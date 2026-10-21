import Link from "next/link";
import { CalendarClock, Layers, Target } from "lucide-react";

import { dueMeta, dueToneClass } from "@/lib/due";

export type ProjectContext = {
  projectId: string;
  phase: {
    name: string;
    status: "in_progress" | "not_started";
    day: number | null; // day N of the phase, when it's running and dated
    of: number | null;
    done: number; // phases completed
    count: number;
  } | null;
  milestone: { name: string; dueDate: string } | null;
  objectives: { total: number; taught: number; assessed: number; gaps: number };
};

/** A project's learning-design context: phase, next milestone, alignment. On the
 *  project page itself (`onProjectPage`) each item jumps to its section instead. */
export function ProjectContextStrip({ context, onProjectPage }: { context: ProjectContext; onProjectPage?: boolean }) {
  const { phase, milestone, objectives } = context;
  const base = onProjectPage ? "" : `/projects/${context.projectId}`;
  const due = milestone ? dueMeta(milestone.dueDate) : null;
  const pct = phase?.day && phase.of ? Math.round((phase.day / phase.of) * 100) : null;
  const gaps = objectives.gaps;

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
      <Item href={`${base}#phases`} icon={<Layers className="size-4" />} label="Phase">
        {phase ? (
          <>
            <span className="truncate font-semibold">
              {phase.name}
              {phase.day && phase.of ? (
                <span className="font-normal text-muted-foreground"> · day {phase.day} of {phase.of}</span>
              ) : phase.status === "not_started" ? (
                <span className="font-normal text-muted-foreground"> · not started</span>
              ) : null}
            </span>
            {pct != null && (
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">No phases yet</span>
        )}
      </Item>

      <Item href={`${base}#milestones`} icon={<CalendarClock className="size-4" />} label="Next milestone">
        {milestone && due ? (
          <span className="truncate">
            <span className="font-semibold">{milestone.name}</span>{" "}
            <span className={dueToneClass[due.tone]}>· {due.label}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Nothing scheduled</span>
        )}
      </Item>

      <Item href={`${base}#alignment`} icon={<Target className="size-4" />} label="Alignment">
        {objectives.total === 0 ? (
          <span className="text-muted-foreground">No objectives yet</span>
        ) : (
          <span className="truncate">
            <span className="font-semibold">
              {objectives.taught}/{objectives.total} taught · {objectives.assessed}/{objectives.total} assessed
            </span>
            {gaps > 0 && <span className="text-warning-ink"> · {gaps} gap{gaps === 1 ? "" : "s"}</span>}
          </span>
        )}
      </Item>
    </div>
  );
}

function Item({
  href,
  icon,
  label,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="flex min-w-0 items-start gap-3 bg-surface px-4 py-3 text-sm hover:bg-hover">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {children}
      </span>
    </Link>
  );
}
