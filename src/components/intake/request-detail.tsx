"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowUpCircle, MessageCircleQuestion, RotateCcw, XCircle } from "lucide-react";
import {
  scoreIntakeRequest,
  assignIntakeRequest,
  rejectIntakeRequest,
  reopenIntakeRequest,
  askIntakeRequester,
  resumeIntakeTriage,
} from "@/app/actions/intake";
import {
  INTAKE_STATUS_LABEL,
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
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/status-badge";
import { SectionHeader } from "@/components/shared/page";
import { ApproveDialog } from "@/components/intake/approve-dialog";
import type { Viewer } from "@/components/intake/triage-queue";
import { useSetPageTitle } from "@/components/app-shell/breadcrumbs";

type Member = { id: string; name: string | null; email: string };
export type DetailRequest = {
  id: string;
  number: number;
  title: string;
  description: string;
  requesterName: string;
  /** Only sent to admins and managers. */
  requesterEmail: string | null;
  targetAudience: string | null;
  targetDate: string | null;
  impactScore: number | null;
  effortScore: number | null;
  status: string;
  assignedToId: string | null;
  rejectionReason: string | null;
  convertedProjectId: string | null;
  infoQuestion: string | null;
  infoRequestedAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  createdAt: string;
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
// Needed-by dates are calendar days stored as UTC midnight.
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function RequestDetail({ request, members, viewer }: { request: DetailRequest; members: Member[]; viewer: Viewer }) {
  useSetPageTitle(ticketLabel(request.number));
  const [pending, startTransition] = useTransition();
  const [impact, setImpact] = useState(request.impactScore);
  const [effort, setEffort] = useState(request.effortScore);
  const [panel, setPanel] = useState<"none" | "reject" | "ask">("none");
  const [reason, setReason] = useState("");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);

  const resolved = isResolved(request.status);
  const work = !resolved && canWorkIntake(viewer.role, viewer.id, request.assignedToId);
  const decide = !resolved && viewer.decide;
  const due = dueMeta(request.targetDate);
  const quadrant = quadrantLabel(impact, effort);
  const assignee = members.find((m) => m.id === request.assignedToId);
  const decidedLine = request.decidedAt ? `${fmt(request.decidedAt)}${request.decidedBy ? ` by ${request.decidedBy}` : ""}` : null;

  function run(action: () => Promise<{ error: string } | undefined>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res?.error) setError(res.error);
      else after?.();
    });
  }

  function updateScore(nextImpact: number | null, nextEffort: number | null) {
    setImpact(nextImpact);
    setEffort(nextEffort);
    if (nextImpact == null || nextEffort == null) return;
    run(() => scoreIntakeRequest(request.id, nextImpact, nextEffort));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card className="gap-3 p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{ticketLabel(request.number)}</span>
            <StatusBadge tone={intakeStatusTone(request.status)}>
              {INTAKE_STATUS_LABEL[request.status as IntakeStatus] ?? request.status}
            </StatusBadge>
            {quadrant && <StatusBadge tone="neutral">{quadrant}</StatusBadge>}
            {due && request.targetDate && <span className={dueToneClass[due.tone]}>Needed by {fmtDay(request.targetDate)} ({due.label})</span>}
            <span>Submitted {fmt(request.createdAt)}</span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{request.description}</p>
          {request.targetAudience && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Audience:</span> {request.targetAudience}
            </p>
          )}
        </Card>

        {request.infoQuestion && (
          <Card className={request.status === "needs_info" ? "gap-2 border-warning/35 bg-warning/7 p-4" : "gap-2 p-4"}>
            <p className="text-sm font-medium">
              {request.status === "needs_info" ? "Waiting on the requester" : "Question asked"}
              {request.infoRequestedAt && <span className="font-normal text-muted-foreground"> · {fmt(request.infoRequestedAt)}</span>}
            </p>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{request.infoQuestion}</p>
            {request.status === "needs_info" && (
              <>
                <p className="text-xs text-muted-foreground">Their answer comes back by email to whoever asked.</p>
                {work && (
                  <Button size="sm" variant="outline" className="self-start" disabled={pending} onClick={() => run(() => resumeIntakeTriage(request.id))}>
                    Answer received · back to triage
                  </Button>
                )}
              </>
            )}
          </Card>
        )}

        {request.status === "rejected" && (
          <Card className="gap-2 border-destructive/35 bg-destructive/7 p-4">
            <p className="text-sm font-medium text-destructive-ink">
              Rejected{decidedLine && <span className="font-normal text-muted-foreground"> · {decidedLine}</span>}
            </p>
            {request.rejectionReason && <p className="text-sm text-muted-foreground">{request.rejectionReason}</p>}
            {viewer.decide && (
              <Button size="sm" variant="outline" className="self-start" disabled={pending} onClick={() => run(() => reopenIntakeRequest(request.id))}>
                <RotateCcw className="size-4" /> Reopen
              </Button>
            )}
          </Card>
        )}

        {request.convertedProjectId && (
          <Card className="gap-1 border-success/35 bg-success/7 p-4">
            <p className="text-sm font-medium text-success-ink">
              Approved and converted to a project{decidedLine && <span className="font-normal text-muted-foreground"> · {decidedLine}</span>}
            </p>
            <Link
              href={`/projects/${request.convertedProjectId}`}
              className="text-sm font-medium text-accent underline underline-offset-2 hover:no-underline"
            >
              View project
            </Link>
          </Card>
        )}
        {error && resolved && <p className="text-sm text-destructive-ink">{error}</p>}
      </div>

      <div className="flex flex-col gap-4">
        <Card className="gap-1 p-5">
          <SectionHeader>Requester</SectionHeader>
          <p className="text-sm font-medium">{request.requesterName}</p>
          {request.requesterEmail && <p className="text-sm text-muted-foreground">{request.requesterEmail}</p>}
        </Card>

        {!resolved && (
          <Card className="gap-4 p-5">
            <SectionHeader>Triage</SectionHeader>
            <div className="grid grid-cols-2 gap-3">
              <ScoreSelect label="Impact" value={impact} disabled={!work || pending} onChange={(v) => updateScore(v, effort)} />
              <ScoreSelect label="Effort" value={effort} disabled={!work || pending} onChange={(v) => updateScore(impact, v)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="intake-assignee" className="text-xs font-medium text-muted-foreground">Assigned to</label>
              {decide ? (
                <Select
                  id="intake-assignee"
                  value={request.assignedToId ?? ""}
                  disabled={pending}
                  onChange={(e) => run(() => assignIntakeRequest(request.id, e.target.value || null))}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name ?? m.email}</option>
                  ))}
                </Select>
              ) : (
                <p className="text-sm">{assignee ? (assignee.name ?? assignee.email) : "Unassigned"}</p>
              )}
            </div>

            {error && <p className="text-sm text-destructive-ink">{error}</p>}

            {(work || decide) && (
              <div className="flex flex-col gap-2 pt-2">
                {decide && (
                  <ApproveDialog
                    request={request}
                    trigger={
                      <Button disabled={pending}>
                        <ArrowUpCircle className="size-4" /> Approve &amp; create project
                      </Button>
                    }
                  />
                )}

                {work && panel !== "ask" && (
                  <Button variant="outline" disabled={pending} onClick={() => setPanel("ask")}>
                    <MessageCircleQuestion className="size-4" /> Ask the requester…
                  </Button>
                )}
                {panel === "ask" && (
                  <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                    <label htmlFor="intake-question" className="text-xs font-medium text-muted-foreground">
                      Emailed to {request.requesterName}; they reply to you.
                    </label>
                    <Textarea
                      id="intake-question"
                      placeholder="What do you need to know?"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      maxLength={2000}
                      rows={4}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={pending || !question.trim()}
                        onClick={() => run(() => askIntakeRequester(request.id, question), () => { setPanel("none"); setQuestion(""); })}
                      >
                        {pending ? "Sending…" : "Send question"}
                      </Button>
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => setPanel("none")}>Cancel</Button>
                    </div>
                  </div>
                )}

                {decide && panel !== "reject" && (
                  <Button variant="outline" disabled={pending} onClick={() => setPanel("reject")}>
                    <XCircle className="size-4" /> Reject…
                  </Button>
                )}
                {panel === "reject" && (
                  <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                    <label htmlFor="intake-reason" className="text-xs font-medium text-muted-foreground">
                      Reason (optional; emailed to the requester)
                    </label>
                    <Textarea id="intake-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => rejectIntakeRequest(request.id, reason), () => setPanel("none"))}>
                        {pending ? "Rejecting…" : "Confirm reject"}
                      </Button>
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => setPanel("none")}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {!work && !decide && (
              <p className="text-xs text-muted-foreground">Admins and managers triage requests; whoever it&rsquo;s assigned to can score it and ask the requester questions.</p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function ScoreSelect({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number | null;
  disabled: boolean;
  onChange: (v: number | null) => void;
}) {
  const id = `intake-${label.toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
      <Select id={id} value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
        <option value="">Not scored</option>
        {SCORE_VALUES.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </Select>
    </div>
  );
}
