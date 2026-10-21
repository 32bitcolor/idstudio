"use client";

import { useState, useTransition } from "react";
import { Copy, Link2Off, Mail, MoreHorizontal, RefreshCw, UserPlus, UserRound } from "lucide-react";

import {
  addRoundReviewer,
  getGuestLink,
  resendGuestInvite,
  resetGuestLink,
  revokeGuestLink,
} from "@/app/actions/reviews";
import type { MentionMember } from "@/components/board/mention-list";
import { GuestList } from "@/components/project/review-rounds";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { REVIEW_STATUS_LABEL, type ReviewStatus } from "@/lib/methodology";
import { cn } from "@/lib/utils";

export type GuestLinkState = { lastSeenAt: string | null; expiresAt: string; revoked: boolean };

export type Assignment = {
  id: string;
  status: string;
  feedback: string | null;
  decidedAt: string | null;
  reviewer: { id: string; name: string } | null;
  /** Email and link state are only sent to members, never to a guest viewer. */
  guest: { id: string; name: string; email: string | null; link: GuestLinkState | null } | null;
};

const DECISION_TONE: Record<string, "neutral" | "info" | "warning" | "success"> = {
  requested: "neutral",
  in_review: "info",
  changes_requested: "warning",
  approved_with_changes: "success",
  approved: "success",
};

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function linkLine(link: GuestLinkState): { text: string; warn: boolean } {
  if (link.revoked) return { text: "Link turned off", warn: true };
  if (new Date(link.expiresAt).getTime() < Date.now()) return { text: "Link expired", warn: true };
  return { text: link.lastSeenAt ? `Opened ${ago(link.lastSeenAt)}` : "Not opened yet", warn: false };
}

export function ReviewerList({
  assignments,
  roundOpen,
  manage,
  roundId,
  members,
}: {
  assignments: Assignment[];
  roundOpen: boolean;
  /** Members see guest emails, link status and the link controls; guests see names. */
  manage: boolean;
  roundId: string;
  members: MentionMember[];
}) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Reviewers">
      {assignments.map((a) => {
        const name = a.reviewer?.name ?? a.guest?.name ?? "Former reviewer";
        const link = manage && a.guest?.link ? linkLine(a.guest.link) : null;
        return (
          <li key={a.id} className="flex min-w-0 max-w-full flex-col gap-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
            <span className="flex flex-wrap items-center gap-2">
              {a.guest && <UserRound className="size-3.5 text-muted-foreground" aria-hidden="true" />}
              <span className="font-medium">{name}</span>
              {a.guest && (
                <span className="rounded bg-muted px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Guest</span>
              )}
              <StatusBadge tone={DECISION_TONE[a.status] ?? "neutral"}>
                {REVIEW_STATUS_LABEL[a.status as ReviewStatus] ?? a.status}
              </StatusBadge>
              {manage && a.guest && <GuestMenu assignmentId={a.id} name={a.guest.name} revoked={!!a.guest.link?.revoked} />}
            </span>
            {link && (
              <span className={cn("text-xs", link.warn ? "text-warning-ink" : "text-muted-foreground")} suppressHydrationWarning>
                {a.guest?.email} · {link.text}
              </span>
            )}
            {a.feedback && <span className="max-w-md text-xs text-muted-foreground">“{a.feedback}”</span>}
          </li>
        );
      })}
      {manage && roundOpen && (
        <li>
          <AddReviewer roundId={roundId} members={members} taken={new Set(assignments.flatMap((a) => (a.reviewer ? [a.reviewer.id] : [])))} />
        </li>
      )}
    </ul>
  );
}

function GuestMenu({ assignmentId, name, revoked }: { assignmentId: string; name: string; revoked: boolean }) {
  const [note, setNote] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function say(text: string) {
    setNote(text);
    setTimeout(() => setNote((n) => (n === text ? null : n)), 2500);
  }

  async function copy(url: string) {
    const full = url.startsWith("/") ? `${window.location.origin}${url}` : url;
    try {
      await navigator.clipboard.writeText(full);
      say("Link copied");
    } catch {
      window.prompt("Copy this link:", full);
    }
  }

  return (
    <span className="ml-auto inline-flex items-center gap-1">
      {note && (
        <span role="status" className="text-xs font-medium text-success-ink">
          {note}
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label={`Link options for ${name}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!revoked && (
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() =>
                startTransition(async () => {
                  const res = await getGuestLink(assignmentId);
                  if ("url" in res && res.url) await copy(res.url);
                })
              }
            >
              <Copy className="size-4 text-muted-foreground" /> Copy their link
            </DropdownMenuItem>
          )}
          {!revoked && (
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() =>
                startTransition(async () => {
                  await resendGuestInvite(assignmentId);
                  say("Invite re-sent");
                })
              }
            >
              <Mail className="size-4 text-muted-foreground" /> Re-send the invite
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() =>
              startTransition(async () => {
                const res = await resetGuestLink(assignmentId);
                if ("url" in res && res.url) say("New link emailed");
              })
            }
          >
            <RefreshCw className="size-4 text-muted-foreground" /> {revoked ? "Issue a new link" : "Reset link (old one stops working)"}
          </DropdownMenuItem>
          {!revoked && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive-ink"
                onSelect={() =>
                  startTransition(async () => {
                    await revokeGuestLink(assignmentId);
                  })
                }
              >
                <Link2Off className="size-4" /> Turn off link
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

/** Add a member or a guest to a round that's still open. */
function AddReviewer({ roundId, members, taken }: { roundId: string; members: MentionMember[]; taken: Set<string> }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add(reviewer: Parameters<typeof addRoundReviewer>[1]) {
    setError(null);
    startTransition(async () => {
      const res = await addRoundReviewer(roundId, reviewer);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-full min-h-10 items-center gap-1.5 rounded-lg border border-dashed border-border-strong px-3 text-sm text-muted-foreground outline-none hover:bg-hover hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <UserPlus className="size-4" aria-hidden="true" /> Add reviewer
      </button>
    );
  }

  const available = members.filter((m) => !taken.has(m.id));
  return (
    <div className="flex max-w-xl flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      {available.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">A member</span>
          <div className="flex flex-wrap gap-1.5">
            {available.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={pending}
                onClick={() => add({ memberId: m.id })}
                className="h-7 rounded-full border border-dashed border-border-strong px-2.5 text-xs font-medium text-muted-foreground outline-none hover:bg-hover hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {m.name ?? m.email}
              </button>
            ))}
          </div>
        </div>
      )}
      <GuestList guests={[]} onChange={(g) => g[0] && add({ guest: g[0] })} />
      {error && <p role="alert" className="text-sm text-destructive-ink">{error}</p>}
      <Button size="xs" variant="ghost" className="w-fit" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}
