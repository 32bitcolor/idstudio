"use client";

import { useState, useTransition } from "react";
import { Tag, Trash2, Check, X, Pencil } from "lucide-react";
import { updateLabel, deleteLabel } from "@/app/actions/cards";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared/page";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { LABEL_PALETTE } from "@/lib/label-colors";

export type LabelRow = { id: string; name: string; color: string; uses: number };

export function LabelsManager({ labels: initial }: { labels: LabelRow[] }) {
  const [labels, setLabels] = useState<LabelRow[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState(LABEL_PALETTE[0]);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function beginEdit(l: LabelRow) {
    setEditingId(l.id);
    setDraftName(l.name);
    setDraftColor(l.color);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  async function save(id: string) {
    const name = draftName.trim();
    if (!name) return;
    const res = await updateLabel(id, name, draftColor);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    setLabels((ls) =>
      ls
        .map((l) => (l.id === id ? { ...l, name, color: draftColor } : l))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    cancelEdit();
  }

  async function remove(id: string) {
    const res = await deleteLabel(id);
    if (res && "error" in res && res.error) return res;
    startTransition(() => setLabels((ls) => ls.filter((l) => l.id !== id)));
  }

  return (
    <div className="flex flex-col gap-8">
      <Card className="p-6">
        <h2 className="mb-1 font-medium">Labels are shared across the workspace</h2>
        <p className="text-sm text-muted-foreground">
          One set of labels covers every board, so the same label means the same thing everywhere
          and the team sprint board can filter across projects by it. Add labels from any card;
          rename, recolour, and delete them here. Deleting a label removes it from every card
          that carries it.
        </p>
      </Card>

      <div>
        <SectionHeader>Labels · {labels.length}</SectionHeader>
        {labels.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No labels yet"
            description="Open any card, then add a label from its Labels section — it becomes available on every board."
          />
        ) : (
          <Card className="divide-y divide-border p-0">
            {labels.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                {editingId === l.id ? (
                  <>
                    <span
                      className="rounded px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: draftColor }}
                    >
                      {draftName.trim() || l.name}
                    </span>
                    <Input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") save(l.id);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="h-8 w-44"
                      aria-label="Label name"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      {LABEL_PALETTE.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setDraftColor(c)}
                          aria-label={`Colour ${c}`}
                          className={`size-5 rounded-full ${draftColor === c ? "ring-2 ring-ring ring-offset-1 ring-offset-surface" : ""}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="ml-auto flex items-center gap-1.5">
                      {error && <span className="text-xs text-destructive">{error}</span>}
                      <Button size="sm" onClick={() => save(l.id)}>
                        <Check className="size-4" /> Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        <X className="size-4" /> Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <span
                      className="rounded px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: l.color }}
                    >
                      {l.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {l.uses === 0 ? "Not used yet" : `${l.uses} ${l.uses === 1 ? "card" : "cards"}`}
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => beginEdit(l)}>
                        <Pencil className="size-4" /> Edit
                      </Button>
                      <ConfirmDelete
                        trigger={
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            title="Delete label"
                            aria-label="Delete label"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        }
                        onConfirm={() => remove(l.id)}
                        title={`Delete "${l.name}"?`}
                        description={
                          l.uses === 0
                            ? "This label isn't on any cards."
                            : `This removes the label from ${l.uses} ${l.uses === 1 ? "card" : "cards"} across the workspace.`
                        }
                        confirmLabel="Delete label"
                      />
                    </div>
                  </>
                )}
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
