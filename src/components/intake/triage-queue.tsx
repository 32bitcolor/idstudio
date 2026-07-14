"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowUpCircle } from "lucide-react";
import { scoreIntakeRequest, assignIntakeRequest, approveIntakeRequest } from "@/app/actions/intake";
import { INTAKE_STATUS_LABEL, SCORE_VALUES, quadrantLabel, ticketLabel, type IntakeStatus } from "@/lib/intake";
import { dueMeta, dueToneClass } from "@/lib/due";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { ConfirmDelete } from "@/components/shared/confirm-delete";

type Member = { id: string; name: string | null; email: string };
type Request = {
  id: string;
  number: number;
  title: string;
  description: string;
  requesterName: string;
  requesterEmail: string;
  targetDate: string | null;
  impactScore: number | null;
  effortScore: number | null;
  status: string;
  assignedToId: string | null;
  convertedProjectId: string | null;
};

function statusTone(status: string): StatusTone {
  if (status === "converted" || status === "approved") return "success";
  if (status === "rejected") return "danger";
  if (status === "triaging") return "info";
  return "neutral";
}

export function TriageQueue({ requests, members }: { requests: Request[]; members: Member[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {requests.map((r) => (
        <RequestRow key={r.id} request={r} members={members} />
      ))}
    </ul>
  );
}

function RequestRow({ request, members }: { request: Request; members: Member[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [impact, setImpact] = useState(request.impactScore);
  const [effort, setEffort] = useState(request.effortScore);
  const [error, setError] = useState<string | null>(null);

  const resolved = ["approved", "converted", "rejected"].includes(request.status);
  const due = dueMeta(request.targetDate);
  const quadrant = quadrantLabel(impact, effort);

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

  function approve() {
    startTransition(async () => {
      const res = await approveIntakeRequest(request.id);
      if (res && "error" in res) {
        setError(res.error);
        return;
      }
      if (res?.project) router.push(`/projects/${res.project.id}`);
    });
  }

  return (
    <li>
      <Card className="gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{ticketLabel(request.number)}</span>
              <StatusBadge tone={statusTone(request.status)}>
                {INTAKE_STATUS_LABEL[request.status as IntakeStatus] ?? request.status}
              </StatusBadge>
              {quadrant && <StatusBadge tone="neutral">{quadrant}</StatusBadge>}
              {due && <span className={dueToneClass[due.tone]}>{due.label}</span>}
            </div>
            <Link
              href={`/intake/${request.id}`}
              className="mt-1 block truncate font-medium hover:underline"
            >
              {request.title}
            </Link>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {request.requesterName} · {request.requesterEmail}
            </p>
          </div>

          {!resolved && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <div className="w-28">
                <Select
                  aria-label="Impact"
                  value={impact ?? ""}
                  disabled={pending}
                  onChange={(e) => updateScore(e.target.value ? Number(e.target.value) : null, effort)}
                >
                  <option value="">Impact</option>
                  {SCORE_VALUES.map((v) => (
                    <option key={v} value={v}>
                      Impact {v}
                    </option>
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
                    <option key={v} value={v}>
                      Effort {v}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-40">
                <Select
                  aria-label="Assign to"
                  value={request.assignedToId ?? ""}
                  disabled={pending}
                  onChange={(e) => assign(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name ?? m.email}
                    </option>
                  ))}
                </Select>
              </div>
              <ConfirmDelete
                trigger={
                  <Button size="sm" disabled={pending}>
                    <ArrowUpCircle className="size-4" /> Approve
                  </Button>
                }
                title="Convert this request into a project?"
                description={`Creates a new ADDIE project from "${request.title}" and marks this request as converted.`}
                confirmLabel="Approve & convert"
                onConfirm={approve}
              />
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
        {error && <p className="text-sm text-destructive">{error}</p>}
      </Card>
    </li>
  );
}
