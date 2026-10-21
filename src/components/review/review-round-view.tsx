"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Check,
  CircleSlash,
  MessageSquare,
  MessageSquarePlus,
  Quote,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Undo2,
} from "lucide-react";

import {
  addReviewComment,
  deleteReviewComment,
  overrideReviewRound,
  setReviewCommentStatus,
  setReviewFeedback,
  setReviewStatus,
  type ReviewCommentDTO,
} from "@/app/actions/reviews";
import { useSetPageTitle } from "@/components/app-shell/breadcrumbs";
import { CommentBody, CommentComposer } from "@/components/board/comment-editor";
import type { MentionMember } from "@/components/board/mention-list";
import { roundLabel, roundTone } from "@/components/project/review-rounds";
import { StatusBadge } from "@/components/shared/status-badge";
import { DueChip } from "@/components/shared/work-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GENERAL_ANCHOR,
  SCREEN_FIELDS,
  SCREEN_FIELD_LABEL,
  parseAnchor,
  type ReviewAnchor,
  type ScreenField,
} from "@/lib/review-anchor";
import type { ScreenChange, SnapshotDiff, StoryboardSnapshot } from "@/lib/review-snapshot";
import { REVIEW_STATUS_LABEL, type ReviewStatus } from "@/lib/methodology";
import { extractText } from "@/lib/mentions";
import { cn } from "@/lib/utils";

type Member = { id: string; name: string | null; email: string };
type Assignment = { id: string; status: string; feedback: string | null; decidedAt: string | null; reviewer: Member };
type RoundInfo = {
  id: string;
  number: number;
  dueDate: string | null;
  outcome: string | null;
  overridden: { by: string; at: string; reason: string } | null;
  requestedBy: string | null;
  hasStoryboardNow: boolean;
};

const SCREEN_TYPE_LABEL: Record<string, string> = {
  intro: "Intro",
  content: "Content",
  video: "Video",
  knowledge_check: "Knowledge check",
  interaction: "Interaction",
  assessment: "Assessment",
  summary: "Summary",
};

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** A timestamp in the viewer's own timezone. The server renders it in ITS timezone,
 *  so the text legitimately differs on hydration — hence the suppression. */
function When({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {when(iso)}
    </time>
  );
}

const fieldDomId = (screenId: string, field: ScreenField) => `field-${screenId}-${field}`;
const anchorKey = (a: ReviewAnchor) => (a.kind === "storyboard_field" ? `${a.screenId}:${a.field}` : "general");

/** Whether a stored field has any words in it (empty fields aren't shown). */
function hasText(doc: string | null): boolean {
  return extractText(doc) !== "";
}

export function ReviewRoundView({
  me,
  canOverride,
  members,
  round,
  deliverable,
  project,
  assignments,
  snapshot,
  previousNumber,
  diff,
  initialComments,
}: {
  me: { id: string };
  canOverride: boolean;
  members: MentionMember[];
  round: RoundInfo;
  deliverable: { id: string; name: string };
  project: { id: string; name: string };
  assignments: Assignment[];
  snapshot: StoryboardSnapshot | null;
  previousNumber: number | null;
  diff: SnapshotDiff | null;
  initialComments: ReviewCommentDTO[];
}) {
  useSetPageTitle(`${deliverable.name} · Round ${round.number}`, [
    { label: "Projects", href: "/projects" },
    { label: project.name, href: `/projects/${project.id}` },
  ]);

  const [comments, setComments] = useState<ReviewCommentDTO[]>(initialComments);
  const [composing, setComposing] = useState<{ anchor: ReviewAnchor } | null>(null);
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const threads = useMemo(() => comments.filter((c) => !c.parentId), [comments]);
  const repliesOf = useMemo(() => {
    const m = new Map<string, ReviewCommentDTO[]>();
    for (const c of comments) if (c.parentId) m.set(c.parentId, [...(m.get(c.parentId) ?? []), c]);
    return m;
  }, [comments]);
  const countByAnchor = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of threads) if (t.status === "open") m.set(anchorKey(parseAnchor(t.anchor)), (m.get(anchorKey(parseAnchor(t.anchor))) ?? 0) + 1);
    return m;
  }, [threads]);

  const screenIndex = useMemo(() => new Map(snapshot?.screens.map((s, i) => [s.id, i]) ?? []), [snapshot]);
  const screenTitle = (id: string) => {
    const i = screenIndex.get(id);
    return i === undefined ? "A removed screen" : `${i + 1}. ${snapshot!.screens[i].title}`;
  };

  function jumpTo(a: ReviewAnchor) {
    if (a.kind !== "storyboard_field") return;
    if (onlyChanged && diff?.screens[a.screenId]?.kind === "unchanged") setOnlyChanged(false);
    const id = fieldDomId(a.screenId, a.field);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlash(id);
      setTimeout(() => setFlash((f) => (f === id ? null : f)), 1600);
    });
  }

  async function post(anchor: ReviewAnchor, body: string, parentId?: string) {
    const res = await addReviewComment(round.id, anchor, body, parentId ?? null);
    if (res && "comment" in res && res.comment) {
      setComments((prev) => [...prev, res.comment!]);
      if (!parentId) setComposing(null);
      return null;
    }
    return res && "error" in res ? res.error ?? "Couldn't post that comment." : null;
  }

  const myAssignment = assignments.find((a) => a.reviewer.id === me.id) ?? null;
  const approved = assignments.filter((a) => a.status === "approved").length;
  const changedCount = diff?.changedCount ?? 0;
  const visibleScreens =
    snapshot?.screens.filter((s) => !onlyChanged || !diff || diff.screens[s.id]?.kind !== "unchanged") ?? [];

  return (
    <div className="flex min-h-screen min-w-0 flex-col gap-4 px-6 pt-5 pb-10">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[14rem] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {deliverable.name} <span className="text-muted-foreground">· Round {round.number}</span>
            </h1>
            <StatusBadge tone={roundTone(round.outcome)}>
              {round.overridden && <ShieldCheck className="size-3" aria-hidden="true" />}
              {roundLabel(round.outcome, !!round.overridden)}
            </StatusBadge>
            {round.dueDate && !round.outcome && <DueChip iso={round.dueDate} className="text-xs font-medium" />}
          </div>
          <p className="mt-1 flex flex-wrap gap-x-2 text-sm text-muted-foreground">
            <Link href={`/projects/${project.id}`} className="hover:text-foreground hover:underline">{project.name}</Link>
            {round.requestedBy && <span>· requested by {round.requestedBy}</span>}
            <span>· {approved}/{assignments.length} approved</span>
          </p>
        </div>
        {canOverride && round.outcome !== "passed" && <OverrideButton roundId={round.id} approved={approved} total={assignments.length} />}
      </header>

      {round.overridden && (
        <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
          <ShieldCheck className="mr-1.5 inline size-4 text-accent" aria-hidden="true" />
          <span className="font-semibold">Passed by override</span>{" "}
          <span className="text-muted-foreground">
            — {round.overridden.by}, <When iso={round.overridden.at} />, with {approved} of {assignments.length} approved:
          </span>{" "}
          “{round.overridden.reason}”
        </p>
      )}

      <Reviewers assignments={assignments} />
      {myAssignment && <DecisionBar assignment={myAssignment} />}

      <div className="flex min-w-0 flex-wrap items-start gap-6">
        {/* ── What's under review ───────────────────────────── */}
        <section aria-label="Storyboard under review" className="flex min-w-0 flex-[999_1_34rem] flex-col gap-3">
          {snapshot ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">
                  {snapshot.title} <span className="font-normal text-muted-foreground">· {snapshot.screens.length} screens, as of this round</span>
                </h2>
                {diff && previousNumber != null && (
                  <div role="group" aria-label="Which screens" className="ml-auto flex rounded-md bg-muted p-0.5">
                    <Toggle active={!onlyChanged} onClick={() => setOnlyChanged(false)}>All screens</Toggle>
                    <Toggle active={onlyChanged} onClick={() => setOnlyChanged(true)}>
                      Changed since round {previousNumber} · {changedCount}
                    </Toggle>
                  </div>
                )}
              </div>
              {diff && diff.removed.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Removed since round {previousNumber}: {diff.removed.map((r) => r.title).join(", ")}
                </p>
              )}
              {onlyChanged && visibleScreens.length === 0 && (
                <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  Nothing changed since round {previousNumber}.
                </p>
              )}
              {visibleScreens.map((s) => (
                <ScreenCard
                  key={s.id}
                  index={screenIndex.get(s.id)! + 1}
                  screen={s}
                  change={diff?.screens[s.id] ?? null}
                  previousNumber={previousNumber}
                  countByAnchor={countByAnchor}
                  flash={flash}
                  composing={composing}
                  members={members}
                  onCompose={(anchor) => setComposing({ anchor })}
                  onCancel={() => setComposing(null)}
                  onPost={(anchor, body) => post(anchor, body)}
                />
              ))}
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              {round.hasStoryboardNow
                ? "This round was started before IDStudio recorded what each round reviewed, so there's no snapshot to show. Comments still work — use the panel."
                : "This deliverable has no storyboard, so there's nothing to pin comments to. Leave feedback for the round in the panel."}
            </div>
          )}
        </section>

        {/* ── Comments ─────────────────────────────────────── */}
        <CommentsPanel
          threads={threads}
          repliesOf={repliesOf}
          me={me}
          canModerate={canOverride}
          members={members}
          screenTitle={screenTitle}
          onJump={jumpTo}
          onPost={post}
          onUpdate={(c) => setComments((prev) => prev.map((x) => (x.id === c.id ? c : x)))}
          onDelete={(id) => setComments((prev) => prev.filter((x) => x.id !== id && x.parentId !== id))}
        />
      </div>
    </div>
  );
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-7 rounded px-2.5 text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        active ? "bg-surface text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

const DECISION_TONE: Record<string, "neutral" | "info" | "warning" | "success"> = {
  requested: "neutral",
  in_review: "info",
  changes_requested: "warning",
  approved: "success",
};

function Reviewers({ assignments }: { assignments: Assignment[] }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Reviewers">
      {assignments.map((a) => (
        <li key={a.id} className="flex min-w-0 max-w-full flex-col gap-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{a.reviewer.name ?? a.reviewer.email}</span>
            <StatusBadge tone={DECISION_TONE[a.status] ?? "neutral"}>
              {REVIEW_STATUS_LABEL[a.status as ReviewStatus] ?? a.status}
            </StatusBadge>
          </span>
          {a.feedback && <span className="max-w-md text-xs text-muted-foreground">“{a.feedback}”</span>}
        </li>
      ))}
    </ul>
  );
}

/** The current user's own decision on this round. */
function DecisionBar({ assignment }: { assignment: Assignment }) {
  const router = useRouter();
  const [summary, setSummary] = useState(assignment.feedback ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const decided = assignment.status === "approved" || assignment.status === "changes_requested";

  function decide(status: "approved" | "changes_requested" | "in_review") {
    setError(null);
    startTransition(async () => {
      if (summary.trim() !== (assignment.feedback ?? "").trim()) await setReviewFeedback(assignment.id, summary);
      const res = await setReviewStatus(assignment.id, status);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section aria-label="Your decision" className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-accent/5 p-4">
      <h2 className="text-sm font-semibold">
        {decided
          ? `You ${assignment.status === "approved" ? "approved" : "requested changes"} — you can still change your decision`
          : "Your decision"}
      </h2>
      <Textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={2}
        placeholder="Summary for the designer (optional) — pin specific feedback to screens below"
        aria-label="Decision summary"
        className="resize-none bg-surface"
      />
      {error && <p role="alert" className="text-sm text-destructive-ink">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => decide("approved")} disabled={pending}>
          <Check className="size-4" aria-hidden="true" /> Approve
        </Button>
        <Button size="sm" variant="outline" onClick={() => decide("changes_requested")} disabled={pending}>
          <RotateCcw className="size-4" aria-hidden="true" /> Request changes
        </Button>
        {assignment.status === "requested" && (
          <Button size="sm" variant="ghost" onClick={() => decide("in_review")} disabled={pending}>
            Mark in review
          </Button>
        )}
      </div>
    </section>
  );
}

function OverrideButton({ roundId, approved, total }: { roundId: string; approved: number; total: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await overrideReviewRound(roundId, reason);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ShieldCheck className="size-4" aria-hidden="true" /> Override…
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pass this round anyway?</DialogTitle>
            <DialogDescription>
              {approved} of {total} reviewers have approved. An override passes the round now; reviewers&apos; own
              decisions stay as they are, and the reason is shown on the round.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex flex-col gap-2"
          >
            <label htmlFor="override-reason" className="text-sm font-medium">Reason</label>
            <Textarea
              id="override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. SME out until after launch; content signed off by the compliance lead instead."
              required
            />
            {error && <p role="alert" className="text-sm text-destructive-ink">{error}</p>}
            <DialogFooter className="mt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending || reason.trim().length < 3}>
                {pending ? "Overriding…" : "Pass by override"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ChangeBadge({ change, previousNumber }: { change: ScreenChange | null; previousNumber: number | null }) {
  if (!change || change.kind === "unchanged" || previousNumber == null) return null;
  return (
    <span className="rounded bg-info/10 px-1.5 py-0.5 text-[11px] font-semibold text-info">
      {change.kind === "added" ? `New since round ${previousNumber}` : `Changed since round ${previousNumber}`}
    </span>
  );
}

function ScreenCard({
  index,
  screen,
  change,
  previousNumber,
  countByAnchor,
  flash,
  composing,
  members,
  onCompose,
  onCancel,
  onPost,
}: {
  index: number;
  screen: StoryboardSnapshot["screens"][number];
  change: ScreenChange | null;
  previousNumber: number | null;
  countByAnchor: Map<string, number>;
  flash: string | null;
  composing: { anchor: ReviewAnchor } | null;
  members: MentionMember[];
  onCompose: (anchor: ReviewAnchor) => void;
  onCancel: () => void;
  onPost: (anchor: ReviewAnchor, body: string) => Promise<string | null>;
}) {
  const fields = SCREEN_FIELDS.filter((f) => hasText(screen.fields[f]));
  const changedFields = change?.kind === "changed" ? new Set(change.fields) : null;

  return (
    <article className="rounded-lg border border-border bg-surface" aria-labelledby={`screen-${screen.id}`}>
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">{index}</span>
        <h3 id={`screen-${screen.id}`} className="font-semibold">{screen.title}</h3>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          {SCREEN_TYPE_LABEL[screen.screenType] ?? screen.screenType}
        </span>
        <ChangeBadge change={change} previousNumber={previousNumber} />
      </header>
      {fields.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">No content on this screen yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {fields.map((f) => {
            const anchor: ReviewAnchor = { kind: "storyboard_field", screenId: screen.id, field: f };
            const key = anchorKey(anchor);
            const open = countByAnchor.get(key) ?? 0;
            const id = fieldDomId(screen.id, f);
            const isComposing =
              composing?.anchor.kind === "storyboard_field" &&
              composing.anchor.screenId === screen.id &&
              composing.anchor.field === f;
            return (
              <div key={f} className="group/field px-4 py-3">
                <div
                  id={id}
                  className={cn(
                    "-mx-2 rounded-md px-2 py-1 transition-colors",
                    changedFields?.has(f) && "border-l-2 border-info pl-2.5",
                    flash === id && "bg-accent/10",
                  )}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">{SCREEN_FIELD_LABEL[f]}</span>
                    {changedFields?.has(f) && <span className="text-[11px] font-semibold text-info">Changed</span>}
                    {open > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <MessageSquare className="size-3.5" aria-hidden="true" />
                        {open}
                        <span className="sr-only"> open comment{open === 1 ? "" : "s"}</span>
                      </span>
                    )}
                    <button
                      type="button"
                      // Keep the reader's text selection alive so it can become the quote.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const sel = window.getSelection();
                        const box = document.getElementById(id);
                        let quote: string | null = null;
                        if (sel && !sel.isCollapsed && box && box.contains(sel.anchorNode) && box.contains(sel.focusNode)) {
                          quote = sel.toString().replace(/\s+/g, " ").trim().slice(0, 500) || null;
                        }
                        onCompose(quote ? { ...anchor, quote: { exact: quote } } : anchor);
                      }}
                      className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground opacity-70 outline-none hover:bg-hover hover:text-foreground focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 group-hover/field:opacity-100"
                      title="Comment — select text first to quote it"
                    >
                      <MessageSquarePlus className="size-3.5" aria-hidden="true" />
                      Comment<span className="sr-only"> on {SCREEN_FIELD_LABEL[f]}, screen {index}</span>
                    </button>
                  </div>
                  <CommentBody body={screen.fields[f] ?? ""} />
                </div>
                {isComposing && composing && (
                  <Composer anchor={composing.anchor} members={members} onCancel={onCancel} onPost={onPost} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function Composer({
  anchor,
  members,
  onCancel,
  onPost,
  label = "Comment",
}: {
  anchor: ReviewAnchor;
  members: MentionMember[];
  onCancel?: () => void;
  onPost: (anchor: ReviewAnchor, body: string) => Promise<string | null>;
  label?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const quote = anchor.kind === "storyboard_field" ? anchor.quote?.exact : undefined;
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {quote && (
        <blockquote className="border-l-2 border-accent pl-2 text-xs text-muted-foreground">“{quote}”</blockquote>
      )}
      <CommentComposer
        mentionMembers={members}
        buttonLabel={label}
        onSubmit={async (json) => {
          setError(await onPost(anchor, json));
        }}
      />
      {error && <p role="alert" className="text-sm text-destructive-ink">{error}</p>}
      {onCancel && (
        <Button size="xs" variant="ghost" className="w-fit" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </div>
  );
}

type Tab = "open" | "closed" | "all";

function CommentsPanel({
  threads,
  repliesOf,
  me,
  canModerate,
  members,
  screenTitle,
  onJump,
  onPost,
  onUpdate,
  onDelete,
}: {
  threads: ReviewCommentDTO[];
  repliesOf: Map<string, ReviewCommentDTO[]>;
  me: { id: string };
  canModerate: boolean;
  members: MentionMember[];
  screenTitle: (id: string) => string;
  onJump: (a: ReviewAnchor) => void;
  onPost: (anchor: ReviewAnchor, body: string, parentId?: string) => Promise<string | null>;
  onUpdate: (c: ReviewCommentDTO) => void;
  onDelete: (id: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("open");
  const open = threads.filter((t) => t.status === "open");
  const closed = threads.filter((t) => t.status !== "open");
  const shown = tab === "open" ? open : tab === "closed" ? closed : threads;

  return (
    <aside
      aria-label="Comments"
      className="flex w-full min-w-0 flex-[1_1_22rem] flex-col gap-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:max-w-md lg:overflow-y-auto"
    >
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">Comments</h2>
        <div role="tablist" aria-label="Filter comments" className="ml-auto flex rounded-md bg-muted p-0.5">
          {(
            [
              ["open", `Open · ${open.length}`],
              ["closed", `Closed · ${closed.length}`],
              ["all", "All"],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              type="button"
              onClick={() => setTab(k)}
              className={cn(
                "h-7 rounded px-2.5 text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                tab === k ? "bg-surface text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="mb-1 text-xs font-medium text-muted-foreground">Comment on the round as a whole</p>
        <Composer anchor={GENERAL_ANCHOR} members={members} onPost={(a, b) => onPost(a, b)} />
      </div>

      {shown.length === 0 && (
        <p className="px-1 text-sm text-muted-foreground">
          {tab === "open" ? "No open comments." : tab === "closed" ? "Nothing resolved yet." : "No comments yet."}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {shown.map((t) => (
          <Thread
            key={t.id}
            thread={t}
            replies={repliesOf.get(t.id) ?? []}
            me={me}
            canModerate={canModerate}
            members={members}
            screenTitle={screenTitle}
            onJump={onJump}
            onReply={(body) => onPost(parseAnchor(t.anchor), body, t.id)}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </aside>
  );
}

const CLOSED_LABEL: Record<string, string> = { resolved: "Resolved", wont_fix: "Won't fix" };

function Thread({
  thread,
  replies,
  me,
  canModerate,
  members,
  screenTitle,
  onJump,
  onReply,
  onUpdate,
  onDelete,
}: {
  thread: ReviewCommentDTO;
  replies: ReviewCommentDTO[];
  me: { id: string };
  canModerate: boolean;
  members: MentionMember[];
  screenTitle: (id: string) => string;
  onJump: (a: ReviewAnchor) => void;
  onReply: (body: string) => Promise<string | null>;
  onUpdate: (c: ReviewCommentDTO) => void;
  onDelete: (id: string) => void;
}) {
  const anchor = parseAnchor(thread.anchor);
  const [replying, setReplying] = useState(false);
  const [closing, setClosing] = useState<"resolved" | "wont_fix" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setStatus(status: "open" | "resolved" | "wont_fix") {
    setError(null);
    startTransition(async () => {
      const res = await setReviewCommentStatus(thread.id, status, status === "open" ? null : note);
      if (res && "comment" in res && res.comment) {
        onUpdate(res.comment);
        setClosing(null);
        setNote("");
      } else if (res && "error" in res) setError(res.error ?? "Couldn't update.");
    });
  }

  function remove(c: ReviewCommentDTO) {
    startTransition(async () => {
      const res = await deleteReviewComment(c.id);
      if (res?.error) setError(res.error);
      else onDelete(c.id);
    });
  }

  const canDelete = (c: ReviewCommentDTO) => c.author?.id === me.id || canModerate;

  return (
    <li className={cn("rounded-lg border bg-surface p-3", thread.status === "open" ? "border-border" : "border-border opacity-80")}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
        {anchor.kind === "storyboard_field" ? (
          <button
            type="button"
            onClick={() => onJump(anchor)}
            className="font-medium text-accent underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {screenTitle(anchor.screenId)} · {SCREEN_FIELD_LABEL[anchor.field]}
          </button>
        ) : (
          <span className="font-medium text-muted-foreground">Whole round</span>
        )}
        {thread.status !== "open" && (
          <StatusBadge tone={thread.status === "resolved" ? "success" : "neutral"}>
            {thread.status === "resolved" ? <Check className="size-3" aria-hidden="true" /> : <CircleSlash className="size-3" aria-hidden="true" />}
            {CLOSED_LABEL[thread.status] ?? thread.status}
          </StatusBadge>
        )}
      </div>
      {anchor.kind === "storyboard_field" && anchor.quote && (
        <blockquote className="mb-1.5 flex gap-1.5 border-l-2 border-accent/60 pl-2 text-xs text-muted-foreground">
          <Quote className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          {anchor.quote.exact}
        </blockquote>
      )}

      <CommentItem comment={thread} canDelete={canDelete(thread)} onDelete={() => remove(thread)} />
      {replies.map((r) => (
        <div key={r.id} className="mt-2 border-l-2 border-border pl-3">
          <CommentItem comment={r} canDelete={canDelete(r)} onDelete={() => remove(r)} />
        </div>
      ))}

      {thread.status !== "open" && (thread.resolvedBy || thread.resolvedNote) && (
        <p className="mt-2 rounded bg-muted px-2 py-1.5 text-xs">
          <span className="font-medium">{thread.resolvedBy ?? "Someone"}</span>
          {thread.resolvedNote ? `: ${thread.resolvedNote}` : " closed this"}
        </p>
      )}

      {error && <p role="alert" className="mt-1 text-xs text-destructive-ink">{error}</p>}

      {closing ? (
        <form
          className="mt-2 flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            setStatus(closing);
          }}
        >
          <Input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={closing === "resolved" ? "What changed? (optional)" : "Why not? (optional)"}
            aria-label="Note for the reviewer"
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <Button size="xs" type="submit" disabled={pending}>
              {closing === "resolved" ? "Resolve" : "Won't fix"}
            </Button>
            <Button size="xs" type="button" variant="ghost" onClick={() => setClosing(null)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1">
          <Button size="xs" variant="ghost" onClick={() => setReplying((r) => !r)}>Reply</Button>
          {thread.status === "open" ? (
            <>
              <Button size="xs" variant="ghost" onClick={() => setClosing("resolved")}>
                <Check className="size-3" aria-hidden="true" /> Resolve
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setClosing("wont_fix")}>
                <CircleSlash className="size-3" aria-hidden="true" /> Won&apos;t fix
              </Button>
            </>
          ) : (
            <Button size="xs" variant="ghost" onClick={() => setStatus("open")} disabled={pending}>
              <Undo2 className="size-3" aria-hidden="true" /> Reopen
            </Button>
          )}
        </div>
      )}
      {replying && (
        <div className="mt-1">
          <CommentComposer
            mentionMembers={members}
            buttonLabel="Reply"
            onSubmit={async (json) => {
              const err = await onReply(json);
              if (err) setError(err);
              else setReplying(false);
            }}
          />
        </div>
      )}
    </li>
  );
}

function CommentItem({
  comment,
  canDelete,
  onDelete,
}: {
  comment: ReviewCommentDTO;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="group/comment">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold">{comment.author ? comment.author.name ?? comment.author.email : "Former member"}</span>
        <span className="text-muted-foreground"><When iso={comment.createdAt} /></span>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto flex size-6 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive-ink focus-visible:opacity-100 group-hover/comment:opacity-100"
            aria-label="Delete comment"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      <div className="mt-0.5">
        <CommentBody body={comment.body} />
      </div>
    </div>
  );
}
