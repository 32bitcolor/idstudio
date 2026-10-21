"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Check, CircleSlash, MessageSquare, Quote, SquareKanban, Undo2 } from "lucide-react";

import { setReviewCommentsStatus } from "@/app/actions/review-feedback";
import type { ReviewCommentDTO } from "@/lib/review-comments";
import { CardChip, SendToBoardDialog } from "@/components/review/send-to-board";
import { roundLabel, roundTone } from "@/components/project/review-rounds";
import { useSetPageTitle } from "@/components/app-shell/breadcrumbs";
import { CommentBody } from "@/components/board/comment-editor";
import { ListPanel, PageContainer, PageHeader } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FeedbackGroup = { key: string; label: string; order: number };
export type FeedbackItem = ReviewCommentDTO & {
  groupKey: string;
  /** Where inside the group: "Narration", "Pin #3 · v2.pdf". */
  detail: string;
  quote: string | null;
  roundId: string;
  roundNumber: number;
  replies: ReviewCommentDTO[];
};

type StatusFilter = "open" | "closed" | "all";
type BoardFilter = "any" | "none" | "linked";

const CLOSED_LABEL: Record<string, string> = { resolved: "Resolved", wont_fix: "Won't fix" };

export function FeedbackView({
  deliverable,
  project,
  rounds,
  groups,
  items,
}: {
  deliverable: { id: string; name: string };
  project: { id: string; name: string };
  rounds: { id: string; number: number; outcome: string | null }[];
  groups: FeedbackGroup[];
  items: FeedbackItem[];
}) {
  useSetPageTitle(`Feedback · ${deliverable.name}`, [
    { label: "Projects", href: "/projects" },
    { label: project.name, href: `/projects/${project.id}` },
  ]);
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>("open");
  const [reviewer, setReviewer] = useState("");
  const [round, setRound] = useState("");
  const [board, setBoard] = useState<BoardFilter>("any");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reviewers = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of items) m.set(i.author?.id ?? "former", i.author ? `${i.author.name}${i.author.guest ? " (guest)" : ""}` : "Former reviewer");
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const matchesOthers = (i: FeedbackItem) =>
    (!reviewer || (i.author?.id ?? "former") === reviewer) &&
    (!round || i.roundId === round) &&
    (board === "any" || (board === "none" ? !i.card : !!i.card));
  const base = items.filter(matchesOthers);
  const openCount = base.filter((i) => i.status === "open").length;
  const shown = base.filter((i) => status === "all" || (status === "open" ? i.status === "open" : i.status !== "open"));
  const shownIds = new Set(shown.map((i) => i.id));
  // Selection only ever covers what's on screen: changing a filter drops hidden rows.
  const picked = [...selected].filter((id) => shownIds.has(id));
  const pickedItems = shown.filter((i) => picked.includes(i.id));

  function toggle(ids: string[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function bulkStatus(next: "open" | "resolved" | "wont_fix") {
    setError(null);
    startTransition(async () => {
      const res = await setReviewCommentsStatus(picked, next, next === "open" ? null : note);
      if (res && "error" in res) {
        setError(res.error ?? "Couldn't update those comments.");
        return;
      }
      setSelected(new Set());
      setNote("");
      router.refresh();
    });
  }

  const linkedCount = items.filter((i) => i.card).length;
  const closedTotal = items.filter((i) => i.status !== "open").length;

  return (
    <PageContainer size="wide" className="flex flex-col gap-5">
      <PageHeader
        title={
          <h1 className="text-2xl font-semibold tracking-tight">
            Feedback <span className="text-muted-foreground">· {deliverable.name}</span>
          </h1>
        }
        description={
          <>
            {items.length - closedTotal} open · {closedTotal} closed · {linkedCount} on a board, across {rounds.length} round
            {rounds.length === 1 ? "" : "s"}
            <span className="mt-2 flex flex-wrap gap-2">
              {rounds.map((r) => (
                <Link
                  key={r.id}
                  href={`/reviews/${r.id}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-hover"
                >
                  Round {r.number}
                  <StatusBadge tone={roundTone(r.outcome)} className="px-1.5 py-0 text-[11px]">{roundLabel(r.outcome, false)}</StatusBadge>
                </Link>
              ))}
            </span>
          </>
        }
      />

      {/* ── Filters ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Status" className="flex rounded-md bg-muted p-0.5">
          {(
            [
              ["open", `Open · ${openCount}`],
              ["closed", `Closed · ${base.length - openCount}`],
              ["all", `All · ${base.length}`],
            ] as [StatusFilter, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={status === k}
              onClick={() => setStatus(k)}
              className={cn(
                "h-7 rounded px-2.5 text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                status === k ? "bg-surface text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Select aria-label="Reviewer" value={reviewer} onChange={(e) => setReviewer(e.target.value)} className="h-8 w-auto text-xs">
          <option value="">All reviewers</option>
          {reviewers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </Select>
        <Select aria-label="Round" value={round} onChange={(e) => setRound(e.target.value)} className="h-8 w-auto text-xs">
          <option value="">All rounds</option>
          {rounds.map((r) => <option key={r.id} value={r.id}>Round {r.number}</option>)}
        </Select>
        <Select aria-label="Board" value={board} onChange={(e) => setBoard(e.target.value as BoardFilter)} className="h-8 w-auto text-xs">
          <option value="any">On a board or not</option>
          <option value="none">Not on a board yet</option>
          <option value="linked">Already on a board</option>
        </Select>
      </div>

      {/* ── Bulk actions ────────────────────────────────────── */}
      {picked.length > 0 && (
        <div
          role="region"
          aria-label="Selected comments"
          className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-surface p-2 shadow-sm"
        >
          <span className="px-1 text-sm font-semibold">{picked.length} selected</span>
          <Button size="sm" onClick={() => setSending(true)} disabled={pending}>
            <SquareKanban className="size-4" aria-hidden="true" /> Send to board…
          </Button>
          {pickedItems.some((i) => i.status === "open") && (
            <>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note for the reviewers (optional)"
                aria-label="Note for the reviewers"
                className="h-8 w-60 text-sm"
              />
              <Button size="sm" variant="outline" onClick={() => bulkStatus("resolved")} disabled={pending}>
                <Check className="size-4" aria-hidden="true" /> Resolve
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkStatus("wont_fix")} disabled={pending}>
                <CircleSlash className="size-4" aria-hidden="true" /> Won&apos;t fix
              </Button>
            </>
          )}
          {pickedItems.some((i) => i.status !== "open") && (
            <Button size="sm" variant="outline" onClick={() => bulkStatus("open")} disabled={pending}>
              <Undo2 className="size-4" aria-hidden="true" /> Reopen
            </Button>
          )}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
          {error && <p role="alert" className="w-full px-1 text-sm text-destructive-ink">{error}</p>}
        </div>
      )}

      {sending && (
        <SendToBoardDialog
          deliverableId={deliverable.id}
          commentIds={picked}
          onClose={() => setSending(false)}
          onSent={() => {
            setSelected(new Set());
            router.refresh();
          }}
        />
      )}

      {/* ── Groups ──────────────────────────────────────────── */}
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No review comments on this deliverable yet.
        </p>
      ) : shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing matches these filters.
        </p>
      ) : (
        groups.map((g) => {
          const rows = shown.filter((i) => i.groupKey === g.key);
          if (rows.length === 0) return null;
          const allOn = rows.every((r) => selected.has(r.id));
          return (
            <section key={g.key} aria-labelledby={`group-${g.key}`}>
              <div className="mb-2 flex items-center gap-2.5 px-1">
                <input
                  type="checkbox"
                  checked={allOn}
                  onChange={(e) => toggle(rows.map((r) => r.id), e.target.checked)}
                  aria-label={`Select all in ${g.label}`}
                  className="size-4 accent-[var(--color-accent)]"
                />
                <h2 id={`group-${g.key}`} className="text-sm font-semibold">{g.label}</h2>
                <span className="text-xs text-muted-foreground">{rows.length}</span>
              </div>
              <ListPanel>
                {rows.map((i) => (
                  <FeedbackRow
                    key={i.id}
                    item={i}
                    selected={selected.has(i.id)}
                    onSelect={(on) => toggle([i.id], on)}
                  />
                ))}
              </ListPanel>
            </section>
          );
        })
      )}
    </PageContainer>
  );
}

function FeedbackRow({ item, selected, onSelect }: { item: FeedbackItem; selected: boolean; onSelect: (on: boolean) => void }) {
  const [showReplies, setShowReplies] = useState(false);
  const closed = item.status !== "open";
  return (
    <li className={cn("flex gap-3 px-4 py-3", selected && "bg-accent/5")}>
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onSelect(e.target.checked)}
        aria-label={`Select comment by ${item.author?.name ?? "former reviewer"}`}
        className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
      />
      <div className={cn("min-w-0 flex-1", closed && "opacity-80")}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium">{item.detail}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">Round {item.roundNumber}</span>
          {closed && (
            <StatusBadge tone={item.status === "resolved" ? "success" : "neutral"}>
              {item.status === "resolved" ? <Check className="size-3" aria-hidden="true" /> : <CircleSlash className="size-3" aria-hidden="true" />}
              {CLOSED_LABEL[item.status] ?? item.status}
            </StatusBadge>
          )}
          {item.card && <CardChip card={item.card} />}
          <Link
            href={`/reviews/${item.roundId}?thread=${item.id}`}
            className="ml-auto font-medium text-accent underline-offset-2 hover:underline"
          >
            Open in round {item.roundNumber} →
          </Link>
        </div>
        {item.quote && (
          <blockquote className="mt-1.5 flex gap-1.5 border-l-2 border-accent/60 pl-2 text-xs text-muted-foreground">
            <Quote className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            {item.quote}
          </blockquote>
        )}
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <span className="font-semibold">{item.author?.name ?? "Former reviewer"}</span>
          {item.author?.guest && (
            <span className="rounded bg-muted px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Guest</span>
          )}
          <time dateTime={item.createdAt} className="text-muted-foreground" suppressHydrationWarning>
            {new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </time>
        </div>
        <div className="mt-0.5 text-sm">
          <CommentBody body={item.body} />
        </div>
        {closed && (item.resolvedBy || item.resolvedNote) && (
          <p className="mt-1.5 rounded bg-muted px-2 py-1.5 text-xs">
            <span className="font-medium">{item.resolvedBy ?? "Someone"}</span>
            {item.resolvedNote ? `: ${item.resolvedNote}` : " closed this"}
          </p>
        )}
        {item.replies.length > 0 && (
          <div className="mt-1.5">
            <button
              type="button"
              aria-expanded={showReplies}
              onClick={() => setShowReplies((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <MessageSquare className="size-3.5" aria-hidden="true" />
              {showReplies ? "Hide" : "Show"} {item.replies.length} repl{item.replies.length === 1 ? "y" : "ies"}
            </button>
            {showReplies &&
              item.replies.map((r) => (
                <div key={r.id} className="mt-2 border-l-2 border-border pl-3">
                  <p className="text-xs font-semibold">
                    {r.author?.name ?? "Former reviewer"}
                    {r.author?.guest && <span className="ml-1 font-normal text-muted-foreground">(guest)</span>}
                  </p>
                  <div className="text-sm"><CommentBody body={r.body} /></div>
                </div>
              ))}
          </div>
        )}
      </div>
    </li>
  );
}
