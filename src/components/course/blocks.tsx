"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Heading as HeadingIcon,
  AlignLeft,
  Quote,
  Image as ImageIcon,
  Minus,
  Rows3,
  CircleHelp,
  Plus,
  X,
  Check,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

import { DescriptionEditor } from "@/components/board/description-editor";
import { cn } from "@/lib/utils";
import type {
  BlockType,
  HeadingContent,
  TextContent,
  StatementContent,
  ImageContent,
  AccordionContent,
  AccordionItem,
  KnowledgeCheckContent,
  KnowledgeCheckOption,
} from "@/lib/course";

export type ProjectObjective = { id: string; text: string };

type EditProps<T> = { content: T; save: (next: T) => void; objectives?: ProjectObjective[] };
type ViewProps<T> = { content: T };

function uid() {
  // Client-only ids for accordion items / KC options.
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2);
}

const input =
  "w-full rounded-md border border-border-strong bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/60";

/** Read-only TipTap render for the learner view. */
function TiptapView({ json }: { json: string | null }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: json ? safeParse(json) : "",
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: "tiptap text-[0.95rem] leading-relaxed" } },
  });
  return <EditorContent editor={editor} />;
}
function safeParse(s: string): object | string {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

// ── Heading ───────────────────────────────────────────────────────────────────
function HeadingEdit({ content, save }: EditProps<HeadingContent>) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={content.level}
        onChange={(e) => save({ ...content, level: Number(e.target.value) as 1 | 2 | 3 })}
        className="rounded-md border border-border-strong bg-transparent px-2 py-1 text-xs"
        aria-label="Heading level"
      >
        <option value={1}>H1</option>
        <option value={2}>H2</option>
        <option value={3}>H3</option>
      </select>
      <input
        value={content.text}
        onChange={(e) => save({ ...content, text: e.target.value })}
        placeholder="Section heading…"
        className={cn(input, "font-semibold")}
      />
    </div>
  );
}
function HeadingView({ content }: ViewProps<HeadingContent>) {
  const cls =
    content.level === 1
      ? "text-3xl font-bold tracking-tight"
      : content.level === 2
        ? "text-2xl font-semibold tracking-tight"
        : "text-lg font-semibold tracking-tight";
  const Tag = (content.level === 1 ? "h1" : content.level === 2 ? "h2" : "h3") as "h1" | "h2" | "h3";
  return <Tag className={cls}>{content.text || "Untitled heading"}</Tag>;
}

// ── Text ──────────────────────────────────────────────────────────────────────
function TextEdit({ content, save }: EditProps<TextContent>) {
  return <DescriptionEditor initial={content.doc} onSave={(doc) => save({ doc })} editorClass="min-h-[80px] text-sm" />;
}
function TextView({ content }: ViewProps<TextContent>) {
  if (!content.doc) return <p className="text-foreground/40">Empty text block.</p>;
  return <TiptapView json={content.doc} />;
}

// ── Statement ─────────────────────────────────────────────────────────────────
function StatementEdit({ content, save }: EditProps<StatementContent>) {
  return (
    <textarea
      value={content.text}
      onChange={(e) => save({ text: e.target.value })}
      rows={2}
      placeholder="A short, emphasized statement…"
      className={cn(input, "resize-none text-lg font-medium")}
    />
  );
}
function StatementView({ content }: ViewProps<StatementContent>) {
  return (
    <div className="border-l-2 border-accent pl-5">
      <p className="text-xl font-medium leading-relaxed text-foreground/90">
        {content.text || "Statement"}
      </p>
    </div>
  );
}

// ── Image ─────────────────────────────────────────────────────────────────────
function ImageEdit({ content, save }: EditProps<ImageContent>) {
  return (
    <div className="flex flex-col gap-2">
      <input value={content.url} onChange={(e) => save({ ...content, url: e.target.value })} placeholder="Image URL (https://…)" className={input} />
      {content.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={content.url} alt={content.alt} className="max-h-56 w-auto rounded-lg border border-border" />
      )}
      <div className="flex gap-2">
        <input value={content.alt} onChange={(e) => save({ ...content, alt: e.target.value })} placeholder="Alt text (accessibility)" className={cn(input, "text-xs")} />
        <input value={content.caption} onChange={(e) => save({ ...content, caption: e.target.value })} placeholder="Caption (optional)" className={cn(input, "text-xs")} />
      </div>
    </div>
  );
}
function ImageView({ content }: ViewProps<ImageContent>) {
  if (!content.url) return <p className="text-foreground/40">No image set.</p>;
  return (
    <figure className="flex flex-col gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={content.url} alt={content.alt} className="w-full rounded-xl border border-border" />
      {content.caption && <figcaption className="text-center text-sm text-muted-foreground">{content.caption}</figcaption>}
    </figure>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
function DividerEdit() {
  return <div className="h-px bg-border-strong" />;
}
function DividerView() {
  return <hr className="border-border" />;
}

// ── Accordion ─────────────────────────────────────────────────────────────────
function AccordionEdit({ content, save }: EditProps<AccordionContent>) {
  function patchItem(id: string, p: Partial<AccordionItem>) {
    save({ items: content.items.map((it) => (it.id === id ? { ...it, ...p } : it)) });
  }
  return (
    <div className="flex flex-col gap-2">
      {content.items.map((it) => (
        <div key={it.id} className="rounded-lg border border-border p-2">
          <div className="flex items-center gap-2">
            <input value={it.title} onChange={(e) => patchItem(it.id, { title: e.target.value })} placeholder="Section title…" className={cn(input, "font-medium")} />
            <button onClick={() => save({ items: content.items.filter((x) => x.id !== it.id) })} className="shrink-0 rounded px-1 text-foreground/40 hover:text-destructive" title="Remove">
              <X className="size-4" />
            </button>
          </div>
          <textarea value={it.body} onChange={(e) => patchItem(it.id, { body: e.target.value })} rows={2} placeholder="Section content…" className={cn(input, "mt-2 resize-none")} />
        </div>
      ))}
      <button
        onClick={() => save({ items: [...content.items, { id: uid(), title: "", body: "" }] })}
        className="self-start rounded-md px-2 py-1 text-sm text-foreground/50 hover:bg-hover"
      >
        <Plus className="mr-1 inline size-3.5" /> Add section
      </button>
    </div>
  );
}
function AccordionView({ content }: ViewProps<AccordionContent>) {
  const [open, setOpen] = useState<string | null>(content.items[0]?.id ?? null);
  if (content.items.length === 0) return <p className="text-foreground/40">No sections yet.</p>;
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {content.items.map((it) => {
        const isOpen = open === it.id;
        return (
          <div key={it.id}>
            <button
              onClick={() => setOpen(isOpen ? null : it.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-medium hover:bg-hover"
              aria-expanded={isOpen}
            >
              <span>{it.title || "Untitled"}</span>
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && <div className="whitespace-pre-wrap px-4 pb-4 text-[0.95rem] leading-relaxed text-foreground/90">{it.body}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── Knowledge check ───────────────────────────────────────────────────────────
function KnowledgeCheckEdit({ content, save, objectives = [] }: EditProps<KnowledgeCheckContent>) {
  function patchOpt(id: string, p: Partial<KnowledgeCheckOption>) {
    save({ ...content, options: content.options.map((o) => (o.id === id ? { ...o, ...p } : o)) });
  }
  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={content.question}
        onChange={(e) => save({ ...content, question: e.target.value })}
        rows={2}
        placeholder="Question…"
        className={cn(input, "resize-none font-medium")}
      />
      <div className="flex flex-col gap-1.5">
        {content.options.map((o) => (
          <div key={o.id} className="flex items-center gap-2">
            <button
              onClick={() => patchOpt(o.id, { correct: !o.correct })}
              title={o.correct ? "Correct answer" : "Mark correct"}
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border",
                o.correct ? "border-success bg-success text-white" : "border-border-strong text-transparent hover:border-foreground/40"
              )}
              style={o.correct ? { backgroundColor: "var(--color-success)", borderColor: "var(--color-success)" } : undefined}
            >
              <Check className="size-3" />
            </button>
            <input value={o.text} onChange={(e) => patchOpt(o.id, { text: e.target.value })} placeholder="Answer option…" className={cn(input, "text-sm")} />
            <button onClick={() => save({ ...content, options: content.options.filter((x) => x.id !== o.id) })} className="shrink-0 rounded px-1 text-foreground/40 hover:text-destructive" title="Remove option">
              <X className="size-4" />
            </button>
          </div>
        ))}
        <button
          onClick={() => save({ ...content, options: [...content.options, { id: uid(), text: "", correct: false }] })}
          className="self-start rounded-md px-2 py-1 text-sm text-foreground/50 hover:bg-hover"
        >
          <Plus className="mr-1 inline size-3.5" /> Add option
        </button>
      </div>
      <textarea
        value={content.feedback}
        onChange={(e) => save({ ...content, feedback: e.target.value })}
        rows={2}
        placeholder="Feedback shown after answering (optional)…"
        className={cn(input, "resize-none text-sm")}
      />
      {objectives.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Assesses:</span>
          {objectives.map((o, i) => {
            const on = content.objectiveIds.includes(o.id);
            return (
              <button
                key={o.id}
                title={o.text}
                onClick={() =>
                  save({
                    ...content,
                    objectiveIds: on ? content.objectiveIds.filter((x) => x !== o.id) : [...content.objectiveIds, o.id],
                  })
                }
                className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium", on ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-hover")}
              >
                O{i + 1}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
function KnowledgeCheckView({ content }: ViewProps<KnowledgeCheckContent>) {
  const [picked, setPicked] = useState<string | null>(null);
  const answered = picked !== null;
  const isRight = (o: KnowledgeCheckOption) => o.correct;
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="mb-3 flex items-start gap-2 font-medium">
        <CircleHelp className="mt-0.5 size-4.5 shrink-0 text-accent" /> {content.question || "Question"}
      </p>
      <div className="flex flex-col gap-2">
        {content.options.map((o) => {
          const chosen = picked === o.id;
          let tone = "border-border hover:bg-hover";
          if (answered && isRight(o)) tone = "border-success";
          else if (answered && chosen && !isRight(o)) tone = "border-destructive";
          return (
            <button
              key={o.id}
              disabled={answered}
              onClick={() => setPicked(o.id)}
              className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default", tone)}
              style={
                answered && isRight(o)
                  ? { borderColor: "var(--color-success)", backgroundColor: "color-mix(in srgb, var(--color-success) 8%, transparent)" }
                  : answered && chosen && !isRight(o)
                    ? { borderColor: "var(--color-destructive)", backgroundColor: "color-mix(in srgb, var(--color-destructive) 8%, transparent)" }
                    : undefined
              }
            >
              <span className="flex-1">{o.text}</span>
              {answered && isRight(o) && <Check className="size-4" style={{ color: "var(--color-success)" }} />}
              {answered && chosen && !isRight(o) && <X className="size-4" style={{ color: "var(--color-destructive)" }} />}
            </button>
          );
        })}
      </div>
      {answered && content.feedback && (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-foreground/80">{content.feedback}</p>
      )}
      {answered && (
        <button onClick={() => setPicked(null)} className="mt-3 text-xs text-muted-foreground hover:underline">
          Try again
        </button>
      )}
    </div>
  );
}

// ── Registry ──────────────────────────────────────────────────────────────────
type Reg = {
  icon: LucideIcon;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Edit: React.FC<EditProps<any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  View: React.FC<ViewProps<any>>;
};

export const BLOCK_REGISTRY: Record<BlockType, Reg> = {
  heading: { icon: HeadingIcon, Edit: HeadingEdit, View: HeadingView },
  text: { icon: AlignLeft, Edit: TextEdit, View: TextView },
  statement: { icon: Quote, Edit: StatementEdit, View: StatementView },
  image: { icon: ImageIcon, Edit: ImageEdit, View: ImageView },
  divider: { icon: Minus, Edit: DividerEdit, View: DividerView },
  accordion: { icon: Rows3, Edit: AccordionEdit, View: AccordionView },
  knowledge_check: { icon: CircleHelp, Edit: KnowledgeCheckEdit, View: KnowledgeCheckView },
};
