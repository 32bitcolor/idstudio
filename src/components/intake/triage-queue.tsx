"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowUpCircle, Search } from "lucide-react";
import { scoreIntakeRequest, assignIntakeRequest } from "@/app/actions/intake";
import {
  INTAKE_STATUS_LABEL,
  OPEN_STATUSES,
  SCORE_VALUES,
  canWorkIntake,
  intakeStatusTone,
  isResolved,
  quadrantLabel,
  ticketLabel,
  type IntakeStatus,
} from "@/lib/intake";
import { dueMeta, dueToneClass } from "@/lib/due";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
import { ApproveDialog } from "@/components/intake/approve-dialog";
import { cn } from "@/lib/utils";

type Member = { id: string; name: string | null; email: string };
export type QueueRequest = {
  id: string;
  number: number;
  title: string;
  requesterName: string;
  /** Only sent to admins and managers. */
  requesterEmail: string | null;
  targetDate: string | null;
  impactScore: number | null;
  effortScore: number | null;
  status: string;
  assignedToId: string | null;
  convertedProjectId: string | null;
};
export type Viewer = { id: string; role: string; decide: boolean };

const TABS = [
  { key: "open", label: "Open", match: (s: string) => (OPEN_STATUSES as readonly string[]).includes(s) },
  { key: "converted", label: "Converted", match: (s: string) => s === "converted" },
  { key: "rejected", label: "Rejected", match: (s: string) => s === "rejected" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function TriageQueue({ requests, members, viewer }: { requests: QueueRequest[]; members: Member[]; viewer: Viewer }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab: TabKey = (TABS.find((t) => t.key === params.get("tab"))?.key ?? "open") as TabKey;
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);

  function setTab(next: TabKey) {
    const sp = new URLSearchParams(params);
    if (next === "open") sp.delete("tab");
    else sp.set("tab", next);
    router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false });
  }

  const needle = q.trim().toLowerCase();
  const inTab = (t: (typeof TABS)[number]) => requests.filter((r) => t.match(r.status));
  const shown = inTab(TABS.find((t) => t.key === tab)!).filter(
    (r) =>
      (!mine || r.assignedToId === viewer.id) &&
      (!needle || `${ticketLabel(r.number)} ${r.title} ${r.requesterName}`.toLowerCase().includes(needle)),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Requests" className="flex rounded-md bg-muted p-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded px-3 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                tab === t.key ? "bg-surface text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span className="text-xs text-muted-foreground">{inTab(t).length}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="size-4 accent-accent" />
            Assigned to me
          </label>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search requests…" aria-label="Search requests" className="h-8 pl-8" />
          </div>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {needle || mine ? "No requests match." : tab === "open" ? "Nothing waiting. The queue is clear." : `No ${tab} requests.`}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((r) => (
            <RequestRow key={r.id} request={r} members={members} viewer={viewer} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestRow({ request, members, viewer }: { request: QueueRequest; members: Member[]; viewer: Viewer }) {
  const [pending, startTransition] = useTransition();
  const [impact, setImpact] = useState(request.impactScore);
  const [effort, setEffort] = useState(request.effortScore);
  const [error, setError] = useState<string | null>(null);

  const resolved = isResolved(request.status);
  const work = !resolved && canWorkIntake(viewer.role, viewer.id, request.assignedToId);
  const decide = !resolved && viewer.decide;
  const due = dueMeta(request.targetDate);
  const quadrant = quadrantLabel(impact, effort);
  const assignee = members.find((m) => m.id === request.assignedToId);

  function updateScore(nextImpact: number | null, nextEffort: number | null) {
    setImpact(nextImpact);
    setEffort(nextEffort);
    if (nextImpact == null || nextEffort == null) return;
    setError(null);
    startTransition(async () => {
      const res = await scoreIntakeRequest(request.id, nextImpact, nextEffort);
      if (res?.error) setError(res.error);
    });
  }

  function assign(userId: string) {
    setError(null);
    startTransition(async () => {
      const res = await assignIntakeRequest(request.id, userId || null);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <li>
      <Card className="gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{ticketLabel(request.number)}</span>
              <StatusBadge tone={intakeStatusTone(request.status)}>
                {INTAKE_STATUS_LABEL[request.status as IntakeStatus] ?? request.status}
              </StatusBadge>
              {quadrant && <StatusBadge tone="neutral">{quadrant}</StatusBadge>}
              {due && <span className={dueToneClass[due.tone]}>{due.label}</span>}
            </div>
            <Link href={`/intake/${request.id}`} className="mt-1 block truncate font-medium hover:underline">
              {request.title}
            </Link>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {request.requesterName}
              {request.requesterEmail && <> · {request.requesterEmail}</>}
              {!decide && assignee && <> · assigned to {assignee.name ?? assignee.email}</>}
              {!work && impact != null && effort != null && <> · impact {impact}, effort {effort}</>}
            </p>
          </div>

          {(work || decide) && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {work && (
                <>
                  <div className="w-28">
                    <Select
                      aria-label="Impact"
                      value={impact ?? ""}
                      disabled={pending}
                      onChange={(e) => updateScore(e.target.value ? Number(e.target.value) : null, effort)}
                    >
                      <option value="">Impact</option>
                      {SCORE_VALUES.map((v) => (
                        <option key={v} value={v}>Impact {v}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-28">
                    <Select
                      aria-label="Effort"
                      value={effort ?? ""}
                      disabled={pending}
                      onChange={(e) => updateScore(impact, e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">Effort</option>
                      {SCORE_VALUES.map((v) => (
                        <option key={v} value={v}>Effort {v}</option>
                      ))}
                    </Select>
                  </div>
                </>
              )}
              {decide && (
                <>
                  <div className="w-40">
                    <Select aria-label="Assign to" value={request.assignedToId ?? ""} disabled={pending} onChange={(e) => assign(e.target.value)}>
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>{m.name ?? m.email}</option>
                      ))}
                    </Select>
                  </div>
                  <ApproveDialog
                    request={request}
                    trigger={
                      <Button size="sm" disabled={pending}>
                        <ArrowUpCircle className="size-4" /> Approve
                      </Button>
                    }
                  />
                </>
              )}
            </div>
          )}

          {request.convertedProjectId && (
            <Link
              href={`/projects/${request.convertedProjectId}`}
              className="text-sm font-medium text-accent underline underline-offset-2 hover:no-underline"
            >
              View project
            </Link>
          )}
        </div>
        {error && <p className="text-sm text-destructive-ink">{error}</p>}
      </Card>
    </li>
  );
}
