"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X, Check, MessageSquare, Paperclip, ArrowUp } from "lucide-react";
import { createWhiteboardForCard } from "@/app/actions/whiteboards";
import {
  getCardDetail,
  updateCardDescription,
  setCardDueDate,
  createLabel,
  toggleCardLabel,
  toggleCardAssignee,
  toggleCardSme,
  addSubtask,
  toggleSubtask,
  deleteSubtask,
  addComment,
  deleteComment,
} from "@/app/actions/cards";
import { renameCard, deleteCard } from "@/app/actions/boards";
import {
  requestUpload,
  finalizeUpload,
  getDownloadUrl,
  deleteAttachment,
} from "@/app/actions/attachments";
import { DescriptionEditor } from "@/components/board/description-editor";
import { assignCardToSprint } from "@/app/actions/sprints";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { dueMeta, dueToneClass } from "@/lib/due";

export type LabelT = { id: string; name: string; color: string };
export type MemberT = { id: string; name: string | null; email: string };
type SubtaskT = {
  id: string; title: string; done: boolean; dueDate: string | null; keySeq: number | null;
  assigneeIds: string[]; commentCount: number; attachmentCount: number;
};
type AttachmentT = { id: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: string };
type WhiteboardT = { id: string; title: string };
type CommentT = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string | null; email: string };
};
export type CardFacePatch = {
  title?: string;
  dueDate?: string | null;
  labels?: LabelT[];
  assignees?: { id: string; name: string | null; email: string }[];
  smes?: { id: string; name: string | null; email: string }[];
  checklist?: { total: number; done: number };
  comments?: number;
  attachments?: number;
};

const PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
];

export function CardDrawer({
  cardId,
  onClose,
  onPatch,
  onDeleted,
  onNavigate,
}: {
  cardId: string;
  onClose: () => void;
  onPatch: (cardId: string, patch: CardFacePatch) => void;
  onDeleted: (cardId: string) => void;
  onNavigate?: (cardId: string) => void;
}) {
  // Loading is derived, not a separate state: we're "loading" whenever the data
  // we hold isn't for the card currently open. This flips synchronously when
  // cardId changes (no setState-in-effect) and back once the fetch resolves.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loading = loadedFor !== cardId;
  const [boardId, setBoardId] = useState("");
  const [cardKeyPrefix, setCardKeyPrefix] = useState<string | null>(null);
  const [keySeq, setKeySeq] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null); // ISO
  const [labelIds, setLabelIds] = useState<Set<string>>(new Set());
  const [assigneeIds, setAssigneeIds] = useState<Set<string>>(new Set());
  const [smeIds, setSmeIds] = useState<Set<string>>(new Set());
  const [sprintId, setSprintId] = useState<string | null>(null);
  const [sprints, setSprints] = useState<{ id: string; name: string }[]>([]);
  const [sprintsEnabled, setSprintsEnabled] = useState(false);
  const [boardLabels, setBoardLabels] = useState<LabelT[]>([]);
  const [members, setMembers] = useState<MemberT[]>([]);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(PALETTE[4]);
  const [subtasks, setSubtasks] = useState<SubtaskT[]>([]);
  const [isSubtask, setIsSubtask] = useState(false);
  const [parent, setParent] = useState<{ id: string; title: string } | null>(null);
  const [comments, setComments] = useState<CommentT[]>([]);
  const [attachments, setAttachments] = useState<AttachmentT[]>([]);
  const [whiteboards, setWhiteboards] = useState<WhiteboardT[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    let active = true;
    getCardDetail(cardId).then((d) => {
      if (!active || !d) return;
      setBoardId(d.boardId);
      setCardKeyPrefix(d.boardCardKeyPrefix);
      setKeySeq(d.card.keySeq);
      setTitle(d.card.title);
      setDescription(d.card.description);
      setDueDate(d.card.dueDate);
      setLabelIds(new Set(d.card.labelIds));
      setAssigneeIds(new Set(d.card.assigneeIds));
      setSmeIds(new Set(d.card.smeIds));
      setSprintId(d.card.sprintId);
      setSprints(d.sprints);
      setSprintsEnabled(d.sprintsEnabled);
      setBoardLabels(d.boardLabels);
      setMembers(d.members);
      setSubtasks(d.subtasks);
      setIsSubtask(d.isSubtask);
      setParent(d.parent);
      setComments(d.comments);
      setAttachments(d.attachments);
      setWhiteboards(d.whiteboards);
      setCurrentUserId(d.currentUserId);
      setIsAdmin(d.isAdmin);
      setLoadedFor(cardId);
    });
    return () => {
      active = false;
    };
  }, [cardId]);

  function saveTitle() {
    const t = title.trim();
    if (!t) return;
    renameCard(cardId, t);
    onPatch(cardId, { title: t });
  }

  function copyShortLink() {
    if (!cardKeyPrefix || keySeq == null) return;
    const url = `${window.location.origin}/c/${cardKeyPrefix}-${keySeq}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    });
  }

  function saveDescription(json: string | null) {
    setDescription(json);
    updateCardDescription(cardId, json);
  }

  function changeDueDate(value: string) {
    const iso = value ? new Date(value).toISOString() : null;
    setDueDate(iso);
    setCardDueDate(cardId, iso);
    onPatch(cardId, { dueDate: iso });
  }

  function patchLabelsFace(nextIds: Set<string>) {
    onPatch(cardId, { labels: boardLabels.filter((l) => nextIds.has(l.id)) });
  }

  function toggleLabel(label: LabelT) {
    const on = !labelIds.has(label.id);
    const next = new Set(labelIds);
    if (on) next.add(label.id);
    else next.delete(label.id);
    setLabelIds(next);
    toggleCardLabel(cardId, label.id, on);
    patchLabelsFace(next);
  }

  async function addLabel() {
    const name = newLabelName.trim();
    if (!name || !boardId) return;
    const res = await createLabel(boardId, name, newLabelColor);
    if ("label" in res && res.label) {
      setBoardLabels((prev) => [...prev, res.label].sort((a, b) => a.name.localeCompare(b.name)));
      setNewLabelName("");
    }
  }

  function toggleAssignee(m: MemberT) {
    const on = !assigneeIds.has(m.id);
    const next = new Set(assigneeIds);
    if (on) next.add(m.id);
    else next.delete(m.id);
    setAssigneeIds(next);
    toggleCardAssignee(cardId, m.id, on);
    onPatch(cardId, { assignees: members.filter((x) => next.has(x.id)) });
  }

  function toggleSme(m: MemberT) {
    const on = !smeIds.has(m.id);
    const next = new Set(smeIds);
    if (on) next.add(m.id);
    else next.delete(m.id);
    setSmeIds(next);
    toggleCardSme(cardId, m.id, on);
    onPatch(cardId, { smes: members.filter((x) => next.has(x.id)) });
  }

  function patchSubtasksFace(items: SubtaskT[]) {
    onPatch(cardId, { checklist: { total: items.length, done: items.filter((i) => i.done).length } });
  }

  async function addItem(title: string) {
    const res = await addSubtask(cardId, title);
    if ("item" in res && res.item) {
      const next = [...subtasks, res.item];
      setSubtasks(next);
      patchSubtasksFace(next);
    }
  }

  function toggleItem(item: SubtaskT) {
    const next = subtasks.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i));
    setSubtasks(next);
    toggleSubtask(item.id, !item.done);
    patchSubtasksFace(next);
  }

  async function removeItem(item: SubtaskT) {
    const prev = subtasks;
    const next = subtasks.filter((i) => i.id !== item.id);
    setSubtasks(next);
    patchSubtasksFace(next);
    // Revert if the server rejects, so the row doesn't vanish then reappear on reload.
    const res = await deleteSubtask(item.id);
    if (res?.error) {
      setSubtasks(prev);
      patchSubtasksFace(prev);
    }
  }

  async function postComment(body: string) {
    const res = await addComment(cardId, body);
    if ("comment" in res && res.comment) {
      const next = [...comments, res.comment];
      setComments(next);
      onPatch(cardId, { comments: next.length });
    }
  }

  async function removeComment(c: CommentT) {
    const prev = comments;
    const next = comments.filter((x) => x.id !== c.id);
    setComments(next);
    onPatch(cardId, { comments: next.length });
    const res = await deleteComment(c.id);
    if (res?.error) {
      setComments(prev);
      onPatch(cardId, { comments: prev.length });
    }
  }

  async function handleFile(file: File) {
    setUploadError(null);
    if (file.size > 25 * 1024 * 1024) {
      setUploadError("File exceeds the 25 MB limit.");
      return;
    }
    setUploading(true);
    try {
      const req = await requestUpload(cardId, file.name, file.type, file.size);
      if ("error" in req) {
        setUploadError(req.error ?? "Upload failed.");
        return;
      }
      const put = await fetch(req.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": req.contentType },
      });
      if (!put.ok) {
        setUploadError("Upload failed.");
        return;
      }
      const fin = await finalizeUpload(cardId, req.key, file.name, file.type, file.size);
      if ("attachment" in fin && fin.attachment) {
        const next = [...attachments, fin.attachment];
        setAttachments(next);
        onPatch(cardId, { attachments: next.length });
      } else if ("error" in fin) {
        setUploadError(fin.error ?? "Upload failed.");
      }
    } catch {
      setUploadError("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function downloadAttachment(a: AttachmentT) {
    const res = await getDownloadUrl(a.id);
    if ("url" in res) window.open(res.url, "_blank");
  }

  async function removeAttachment(a: AttachmentT) {
    // Deleting an uploaded file is unrecoverable, so remove only once the server
    // confirms; the return value flows to ConfirmDelete to surface any error.
    const res = await deleteAttachment(a.id);
    if (res?.error) return res;
    const next = attachments.filter((x) => x.id !== a.id);
    setAttachments(next);
    onPatch(cardId, { attachments: next.length });
  }

  function handleDelete() {
    deleteCard(cardId);
    onDeleted(cardId);
    onClose();
  }

  const doneCount = subtasks.filter((i) => i.done).length;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="flex max-h-[85vh] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden bg-surface p-0 shadow-xl sm:max-w-2xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex-row items-start justify-between gap-2 space-y-0 border-b border-border px-4 py-3 pr-12">
          <DialogTitle asChild>
            <div className="flex-1">
              {cardKeyPrefix && keySeq != null && (
                <button
                  type="button"
                  onClick={copyShortLink}
                  title="Copy shareable link"
                  className="block px-1 font-mono text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                >
                  {cardKeyPrefix}-{keySeq}
                  {linkCopied ? " · Copied!" : ""}
                </button>
              )}
              <textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                rows={1}
                className="min-h-[2rem] w-full resize-none rounded bg-transparent px-1 text-base font-semibold outline-none hover:bg-hover focus:bg-hover"
              />
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">Card details</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-4 text-sm text-foreground/50">Loading…</p>
        ) : (
          <div className="flex flex-col gap-6 p-4">
            {isSubtask && parent && onNavigate && (
              <button
                onClick={() => onNavigate(parent.id)}
                className="-mt-2 flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                <ArrowUp className="size-3" />
                Part of: {parent.title}
              </button>
            )}

            <Section title="Description">
              <DescriptionEditor key={cardId} initial={description} onSave={saveDescription} />
            </Section>

            {!isSubtask && (
              <Section title={`Subtasks${subtasks.length ? ` · ${doneCount}/${subtasks.length}` : ""}`}>
                <div className="flex flex-col gap-0.5">
                  {subtasks.map((item) => (
                    <SubtaskRow
                      key={item.id}
                      item={item}
                      cardKeyPrefix={cardKeyPrefix}
                      members={members}
                      onToggleDone={() => toggleItem(item)}
                      onOpen={() => onNavigate?.(item.id)}
                      onRemove={() => removeItem(item)}
                    />
                  ))}
                </div>
                <InlineComposer placeholder="Add a subtask…" buttonLabel="Add" onSubmit={addItem} />
              </Section>
            )}

            <Section title="Details">
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <Field label="Due date">
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={dueDate ? dueDate.slice(0, 10) : ""}
                      onChange={(e) => changeDueDate(e.target.value)}
                      className="h-8 w-auto"
                    />
                    {dueDate && (
                      <Button variant="link" className="h-auto p-0 text-xs" onClick={() => changeDueDate("")}>
                        Clear
                      </Button>
                    )}
                  </div>
                </Field>

                {!isSubtask && sprintsEnabled && (
                  <Field label="Sprint">
                    <Select
                      value={sprintId ?? ""}
                      onChange={(e) => {
                        const next = e.target.value || null;
                        setSprintId(next);
                        assignCardToSprint(cardId, next);
                      }}
                      className="h-8 w-full py-1 text-xs"
                    >
                      <option value="">No sprint</option>
                      {sprints.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </Select>
                  </Field>
                )}

                <Field label="Assignees">
                  <AssigneePicker members={members} assigneeIds={assigneeIds} onToggle={toggleAssignee} />
                </Field>

                <Field label="SMEs">
                  <AssigneePicker members={members} assigneeIds={smeIds} onToggle={toggleSme} />
                </Field>

                <div className="sm:col-span-2">
                  <Field label="Labels">
                    <div className="flex flex-wrap gap-1.5">
                      {boardLabels.map((l) => {
                        const on = labelIds.has(l.id);
                        return (
                          <button
                            key={l.id}
                            onClick={() => toggleLabel(l)}
                            className={`rounded px-2 py-0.5 text-xs font-medium ${on ? "text-white" : "opacity-50"}`}
                            style={{ backgroundColor: l.color }}
                          >
                            {l.name}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Input
                        value={newLabelName}
                        onChange={(e) => setNewLabelName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addLabel()}
                        placeholder="New label…"
                        className="h-8 w-32 text-xs"
                      />
                      <div className="flex gap-1">
                        {PALETTE.map((c) => (
                          <button
                            key={c}
                            onClick={() => setNewLabelColor(c)}
                            className={`h-5 w-5 rounded-full ${newLabelColor === c ? "ring-2 ring-foreground ring-offset-1" : ""}`}
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                      <Button size="xs" onClick={addLabel}>Add</Button>
                    </div>
                  </Field>
                </div>
              </div>
            </Section>

            <Section title="Attachments">
              <div className="flex flex-col gap-1.5">
                {attachments.length === 0 && <p className="text-sm text-foreground/40">No attachments.</p>}
                {attachments.map((a) => (
                  <div
                    key={a.id}
                    className="group flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
                  >
                    <span className="flex-1 truncate text-sm" title={a.fileName}>
                      {a.fileName}
                    </span>
                    <span className="shrink-0 text-xs text-foreground/40">{formatBytes(a.sizeBytes)}</span>
                    <button
                      onClick={() => downloadAttachment(a)}
                      className="shrink-0 text-xs text-foreground/60 hover:underline"
                    >
                      Download
                    </button>
                    <ConfirmDelete
                      onConfirm={() => removeAttachment(a)}
                      title="Delete this attachment?"
                      description="The uploaded file is permanently deleted and can't be recovered."
                      confirmLabel="Delete file"
                      trigger={
                        <button
                          className="shrink-0 text-foreground/30 opacity-0 hover:text-destructive group-hover:opacity-100"
                          title="Remove"
                        >
                          <X className="size-3.5" />
                        </button>
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <label className="inline-block cursor-pointer rounded-md border border-border-strong px-3 py-1 text-xs hover:bg-hover">
                  {uploading ? "Uploading…" : "+ Add file"}
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {uploadError && <p className="mt-1 text-xs text-destructive">{uploadError}</p>}
              </div>
            </Section>

            <Section title="Whiteboards">
              <div className="flex flex-col gap-1.5">
                {whiteboards.length === 0 && (
                  <p className="text-sm text-foreground/40">No whiteboards linked to this card.</p>
                )}
                {whiteboards.map((w) => (
                  <Link
                    key={w.id}
                    href={`/whiteboards/${w.id}`}
                    className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm hover:bg-hover"
                  >
                    <span className="flex-1 truncate">{w.title}</span>
                    <span className="shrink-0 text-xs text-foreground/40">Open →</span>
                  </Link>
                ))}
              </div>
              <form action={createWhiteboardForCard.bind(null, cardId)} className="mt-2">
                <button className="inline-block cursor-pointer rounded-md border border-border-strong px-3 py-1 text-xs hover:bg-hover">
                  + New whiteboard
                </button>
              </form>
            </Section>

            <Section title="Comments">
              <div className="flex flex-col gap-3">
                {comments.length === 0 && <p className="text-sm text-foreground/40">No comments yet.</p>}
                {comments.map((c) => (
                  <div key={c.id} className="group">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">{c.author.name ?? c.author.email}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-foreground/40">{formatTime(c.createdAt)}</span>
                        {(c.author.id === currentUserId || isAdmin) && (
                          <button
                            onClick={() => removeComment(c)}
                            className="text-xs text-foreground/40 opacity-0 hover:text-destructive group-hover:opacity-100"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.body}</p>
                  </div>
                ))}
              </div>
              <InlineComposer placeholder="Write a comment…" buttonLabel="Comment" multiline onSubmit={postComment} />
            </Section>

            <div className="border-t border-border pt-4">
              <ConfirmDelete
                title="Delete this card?"
                description="This action can't be undone."
                confirmLabel="Delete card"
                onConfirm={handleDelete}
                trigger={
                  <Button variant="link" className="h-auto p-0 text-sm text-destructive">
                    Delete card
                  </Button>
                }
              />
            </div>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

/** A compact labeled field for the details grid (lighter than a full Section). */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function AssigneePicker({
  members,
  assigneeIds,
  onToggle,
}: {
  members: MemberT[];
  assigneeIds: Set<string>;
  onToggle: (m: MemberT) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = members.filter((m) => assigneeIds.has(m.id));

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((m) => (
          <span
            key={m.id}
            className="flex items-center gap-1 rounded-full border border-foreground bg-accent px-2 py-0.5 text-xs text-accent-foreground"
          >
            {m.name ?? m.email}
            <button onClick={() => onToggle(m)} className="text-accent-foreground/70 hover:text-accent-foreground" title="Remove">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-md border border-border-strong px-2 py-0.5 text-xs text-foreground/70 hover:bg-hover"
        >
          + Assign
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 max-h-56 w-60 overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg">
            {members.length === 0 && <p className="px-3 py-1.5 text-sm text-foreground/50">No members</p>}
            {members.map((m) => {
              const on = assigneeIds.has(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => onToggle(m)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-hover"
                >
                  <span className="truncate">{m.name ?? m.email}</span>
                  {on && <Check className="size-3.5 shrink-0 text-foreground/70" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function SubtaskRow({
  item,
  cardKeyPrefix,
  members,
  onToggleDone,
  onOpen,
  onRemove,
}: {
  item: SubtaskT;
  cardKeyPrefix: string | null;
  members: MemberT[];
  onToggleDone: () => void;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const assignees = members.filter((m) => item.assigneeIds.includes(m.id));
  const due = dueMeta(item.dueDate);

  return (
    <div className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-hover/50">
      <input
        type="checkbox"
        checked={item.done}
        onChange={onToggleDone}
        className="h-4 w-4 shrink-0"
      />
      <button
        onClick={onOpen}
        className={`flex-1 truncate text-left text-sm hover:underline ${item.done ? "text-foreground/40 line-through" : ""}`}
      >
        {cardKeyPrefix && item.keySeq != null && (
          <span className="mr-1.5 font-mono text-xs font-medium text-muted-foreground">
            {cardKeyPrefix}-{item.keySeq}
          </span>
        )}
        {item.title}
      </button>

      {item.commentCount > 0 && (
        <StatusBadge tone="neutral">
          <MessageSquare className="size-3" />
          {item.commentCount}
        </StatusBadge>
      )}
      {item.attachmentCount > 0 && (
        <StatusBadge tone="neutral">
          <Paperclip className="size-3" />
          {item.attachmentCount}
        </StatusBadge>
      )}
      {due && (
        <span className={`shrink-0 text-[10px] font-medium whitespace-nowrap ${dueToneClass[due.tone]}`}>
          {due.label}
        </span>
      )}
      {assignees.length > 0 && (
        <div className="flex -space-x-1" title={assignees.map((a) => a.name ?? a.email).join(", ")}>
          {assignees.slice(0, 3).map((a) => (
            <span
              key={a.id}
              className="flex size-5 shrink-0 items-center justify-center rounded-full border border-background bg-accent text-[10px] font-medium text-accent-foreground"
            >
              {(a.name ?? a.email).charAt(0).toUpperCase()}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={onRemove}
        className="shrink-0 text-foreground/30 opacity-0 hover:text-destructive group-hover:opacity-100"
        title="Remove"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function InlineComposer({
  placeholder,
  buttonLabel,
  multiline,
  onSubmit,
}: {
  placeholder: string;
  buttonLabel: string;
  multiline?: boolean;
  onSubmit: (text: string) => void;
}) {
  const [value, setValue] = useState("");

  function submit() {
    const v = value.trim();
    if (!v) return;
    onSubmit(v);
    setValue("");
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder={placeholder}
          className="min-h-0 resize-none text-sm"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={placeholder}
          className="h-8 text-sm"
        />
      )}
      {value.trim() && (
        <div>
          <Button size="xs" onClick={submit}>{buttonLabel}</Button>
        </div>
      )}
    </div>
  );
}
