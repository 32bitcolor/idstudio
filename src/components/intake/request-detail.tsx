"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowUpCircle, XCircle } from "lucide-react";
import {
  scoreIntakeRequest,
  assignIntakeRequest,
  approveIntakeRequest,
  rejectIntakeRequest,
} from "@/app/actions/intake";
import { INTAKE_STATUS_LABEL, SCORE_VALUES, quadrantLabel, ticketLabel, type IntakeStatus } from "@/lib/intake";
import { dueMeta, dueToneClass } from "@/lib/due";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { SectionHeader } from "@/components/shared/page";
import { ConfirmDelete } from "@/components/shared/confirm-delete";

type Member = { id: string; name: string | null; email: string };
type Request = {
  id: string;
  number: number;
  title: string;
  description: string;
  requesterName: string;
  requesterEmail: string;
  targetAudience: string | null;
  targetDate: string | null;
  impactScore: number | null;
  effortScore: number | null;
  status: string;
  assignedToId: string | null;
  rejectionReason: string | null;
  convertedProjectId: string | null;
};

function statusTone(status: string): StatusTone {
  if (status === "converted" || status === "approved") return "success";
  if (status === "rejected") return "danger";
  if (status === "triaging") return "info";
  return "neutral";
}

export function RequestDetail({ request, members }: { request: Request; members: Member[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [impact, setImpact] = useState(request.impactScore);
  const [effort, setEffort] = useState(request.effortScore);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
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

  function reject() {
    startTransition(async () => {
      const res = await rejectIntakeRequest(request.id, reason);
      if (res?.error) setError(res.error);
      else setShowReject(false);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card className="gap-3 p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{ticketLabel(request.number)}</span>
            <StatusBadge tone={statusTone(request.status)}>
              {INTAKE_STATUS_LABEL[request.status as IntakeStatus] ?? request.status}
            </StatusBadge>
            {quadrant && <StatusBadge tone="neutral">{quadrant}</StatusBadge>}
            {due && <span className={dueToneClass[due.tone]}>{due.label}</span>}
          </div>
          <p className="whitespace-pre-wrap text-sm">{request.description}</p>
          {request.targetAudience && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Audience:</span> {request.targetAudience}
            </p>
          )}
        </Card>

        {request.status === "rejected" && request.rejectionReason && (
          <Card className="gap-1 border-destructive/35 bg-destructive/7 p-4">
            <p className="text-sm font-medium text-destructive">Rejected</p>
            <p className="text-sm text-muted-foreground">{request.rejectionReason}</p>
          </Card>
        )}

        {request.convertedProjectId && (
          <Card className="gap-1 border-success/35 bg-success/7 p-4">
            <p className="text-sm font-medium text-success">Converted to a project</p>
            <Link
              href={`/projects/${request.convertedProjectId}`}
              className="text-sm font-medium text-accent underline underline-offset-2 hover:no-underline"
            >
              View project
            </Link>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Card className="gap-3 p-5">
          <SectionHeader>Requester</SectionHeader>
          <p className="text-sm font-medium">{request.requesterName}</p>
          <p className="text-sm text-muted-foreground">{request.requesterEmail}</p>
        </Card>

        {!resolved && (
          <Card className="gap-4 p-5">
            <SectionHeader>Triage</SectionHeader>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Impact</label>
              <Select
                value={impact ?? ""}
                disabled={pending}
                onChange={(e) => updateScore(e.target.value ? Number(e.target.value) : null, effort)}
              >
                <option value="">Not scored</option>
                {SCORE_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Effort</label>
              <Select
                value={effort ?? ""}
                disabled={pending}
                onChange={(e) => updateScore(impact, e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Not scored</option>
                {SCORE_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Assigned to</label>
              <Select value={request.assignedToId ?? ""} disabled={pending} onChange={(e) => assign(e.target.value)}>
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name ?? m.email}
                  </option>
                ))}
              </Select>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex flex-col gap-2 pt-2">
              <ConfirmDelete
                trigger={
                  <Button disabled={pending}>
                    <ArrowUpCircle className="size-4" /> Approve &amp; create project
                  </Button>
                }
                title="Convert this request into a project?"
                description={`Creates a new ADDIE project from "${request.title}" and marks this request as converted.`}
                confirmLabel="Approve & convert"
                onConfirm={approve}
              />

              {!showReject ? (
                <Button variant="outline" disabled={pending} onClick={() => setShowReject(true)}>
                  <XCircle className="size-4" /> Reject
                </Button>
              ) : (
                <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  <Textarea
                    placeholder="Reason (optional)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={500}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={pending} onClick={reject}>
                      {pending ? "Rejecting…" : "Confirm reject"}
                    </Button>
                    <Button variant="ghost" size="sm" disabled={pending} onClick={() => setShowReject(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
