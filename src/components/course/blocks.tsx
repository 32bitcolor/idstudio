"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Heading as HeadingIcon,
  AlignLeft,
  Quote as QuoteIcon,
  List as ListIcon,
  Image as ImageIcon,
  Video,
  Minus,
  Rows3,
  LayoutPanelTop,
  ListOrdered,
  Layers,
  CircleHelp,
  Plus,
  X,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Upload,
  Link2,
  Loader2,
  type LucideIcon,
} from "lucide-react";

import { requestCourseImageUpload, getCourseImageViewUrl } from "@/app/actions/courses";
import { DescriptionEditor } from "@/components/board/description-editor";
import { cn } from "@/lib/utils";
import { embedUrl } from "@/lib/course";
import type {
  BlockType,
  HeadingContent,
  TextContent,
  StatementContent,
  QuoteContent,
  ListContent,
  ListStyle,
  ImageContent,
  MultimediaContent,
  AccordionContent,
  AccordionItem,
  TabsContent,
  TabItem,
  ProcessContent,
  ProcessStep,
  FlashcardsContent,
  Flashcard,
  KnowledgeCheckContent,
  KnowledgeCheckOption,
  KnowledgeCheckType,
} from "@/lib/course";
import { KNOWLEDGE_CHECK_TYPES, KNOWLEDGE_CHECK_TYPE_LABEL } from "@/lib/course";

export type ProjectObjective = { id: string; text: string };

type EditProps<T> = {
  content: T;
  save: (next: T) => void;
  courseId?: string;
  objectives?: ProjectObjective[];
};
type ViewProps<T> = { content: T; courseId?: string };

function uid() {
  // Client-only ids for list/card/option items.
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

/** Resolve an uploaded image's key to a fresh inline-view URL (objects aren't public). */
function useImageSrc(courseId: string | undefined, key: string | null, url: string) {
  const [resolved, setResolved] = useState<string | null>(null);
  useEffect(() => {
    if (!key || !courseId) return;
    let active = true;
    getCourseImageViewUrl(courseId, key).then((res) => {
      if (active && "url" in res) setResolved(res.url);
    });
    return () => {
      active = false;
    };
  }, [courseId, key]);
  return key ? resolved : url || null;
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

// ── Quote ─────────────────────────────────────────────────────────────────────
function QuoteEdit({ content, save }: EditProps<QuoteContent>) {
  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={content.quote}
        onChange={(e) => save({ ...content, quote: e.target.value })}
        rows={3}
        placeholder="Quote…"
        className={cn(input, "resize-none italic")}
      />
      <input
        value={content.attribution}
        onChange={(e) => save({ ...content, attribution: e.target.value })}
        placeholder="Attribution (optional)…"
        className={cn(input, "text-sm")}
      />
    </div>
  );
}
function QuoteView({ content }: ViewProps<QuoteContent>) {
  return (
    <figure className="rounded-xl bg-muted px-6 py-5">
      <QuoteIcon className="mb-2 size-6 text-accent/50" />
      <blockquote className="text-lg font-medium italic leading-relaxed text-foreground/90">
        {content.quote || "Quote"}
      </blockquote>
      {content.attribution && (
        <figcaption className="mt-3 text-sm text-muted-foreground">— {content.attribution}</figcaption>
      )}
    </figure>
  );
}

// ── List ──────────────────────────────────────────────────────────────────────
function ListEdit({ content, save }: EditProps<ListContent>) {
  function patch(i: number, value: string) {
    save({ ...content, items: content.items.map((it, idx) => (idx === i ? value : it)) });
  }
  return (
    <div className="flex flex-col gap-2">
      <select
        value={content.style}
        onChange={(e) => save({ ...content, style: e.target.value as ListStyle })}
        className="self-start rounded-md border border-border-strong bg-transparent px-2 py-1 text-xs"
      >
        <option value="bullet">Bulleted</option>
        <option value="number">Numbered</option>
        <option value="check">Checked</option>
      </select>
      {content.items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <input value={it} onChange={(e) => patch(i, e.target.value)} placeholder="List item…" className={cn(input, "text-sm")} />
          <button onClick={() => save({ ...content, items: content.items.filter((_, idx) => idx !== i) })} className="shrink-0 rounded px-1 text-foreground/40 hover:text-destructive" title="Remove">
            <X className="size-4" />
          </button>
        </div>
      ))}
      <button onClick={() => save({ ...content, items: [...content.items, ""] })} className="self-start rounded-md px-2 py-1 text-sm text-foreground/50 hover:bg-hover">
        <Plus className="mr-1 inline size-3.5" /> Add item
      </button>
    </div>
  );
}
function ListView({ content }: ViewProps<ListContent>) {
  if (content.items.length === 0) return <p className="text-foreground/40">No items yet.</p>;
  if (content.style === "number") {
    return (
      <ol className="list-decimal space-y-1.5 pl-5">
        {content.items.map((it, i) => (
          <li key={i} className="text-[0.95rem] leading-relaxed text-foreground/90">{it}</li>
        ))}
      </ol>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {content.items.map((it, i) => (
        <li key={i} className="flex items-start gap-2 text-[0.95rem] leading-relaxed text-foreground/90">
          {content.style === "check" ? (
            <Check className="mt-1 size-3.5 shrink-0 text-accent" />
          ) : (
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent/70" />
          )}
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Image (real upload) ───────────────────────────────────────────────────────
function ImageEdit({ content, save, courseId }: EditProps<ImageContent>) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlMode, setUrlMode] = useState(!content.key && !!content.url);
  const fileRef = useRef<HTMLInputElement>(null);
  const src = useImageSrc(courseId, content.key, content.url);

  async function handleFile(file: File) {
    if (!courseId) return;
    setError(null);
    if (!file.type.startsWith("image/")) { setError("Only image files are supported."); return; }
    if (file.size > 25 * 1024 * 1024) { setError("Image exceeds the 25 MB limit."); return; }
    setUploading(true);
    try {
      const res = await requestCourseImageUpload(courseId, file.name, file.type, file.size);
      if ("error" in res) { setError(res.error); return; }
      const put = await fetch(res.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!put.ok) { setError("Upload failed."); return; }
      save({ ...content, key: res.key, url: "" });
    } catch {
      setError("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5">
        <button
          onClick={() => setUrlMode(false)}
          className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium", !urlMode ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-hover")}
        >
          <Upload className="size-3.5" /> Upload
        </button>
        <button
          onClick={() => setUrlMode(true)}
          className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium", urlMode ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-hover")}
        >
          <Link2 className="size-3.5" /> Use a URL
        </button>
      </div>

      {urlMode ? (
        <input
          value={content.key ? "" : content.url}
          onChange={(e) => save({ ...content, key: null, url: e.target.value })}
          placeholder="Image URL (https://…)"
          className={input}
        />
      ) : (
        <div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || !courseId}
            className="flex items-center gap-2 rounded-md border border-dashed border-border-strong px-3 py-2 text-sm text-muted-foreground hover:border-foreground/40 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {uploading ? "Uploading…" : "Choose an image…"}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={content.alt} className="max-h-56 w-auto rounded-lg border border-border" />
      )}
      <div className="flex gap-2">
        <input value={content.alt} onChange={(e) => save({ ...content, alt: e.target.value })} placeholder="Alt text (accessibility)" className={cn(input, "text-xs")} />
        <input value={content.caption} onChange={(e) => save({ ...content, caption: e.target.value })} placeholder="Caption (optional)" className={cn(input, "text-xs")} />
      </div>
    </div>
  );
}
function ImageView({ content, courseId }: ViewProps<ImageContent>) {
  const src = useImageSrc(courseId, content.key, content.url);
  if (!src) return <p className="text-foreground/40">No image set.</p>;
  return (
    <figure className="flex flex-col gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={content.alt} className="w-full rounded-xl border border-border" />
      {content.caption && <figcaption className="text-center text-sm text-muted-foreground">{content.caption}</figcaption>}
    </figure>
  );
}

// ── Multimedia (video embed) ──────────────────────────────────────────────────
function MultimediaEdit({ content, save }: EditProps<MultimediaContent>) {
  const embed = embedUrl(content.url);
  return (
    <div className="flex flex-col gap-2">
      <input
        value={content.url}
        onChange={(e) => save({ ...content, url: e.target.value })}
        placeholder="YouTube or Vimeo URL…"
        className={input}
      />
      {content.url && !embed && <p className="text-xs text-muted-foreground">Paste a YouTube or Vimeo link to embed it.</p>}
      {embed && (
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-border">
          <iframe src={embed} className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        </div>
      )}
      <input value={content.caption} onChange={(e) => save({ ...content, caption: e.target.value })} placeholder="Caption (optional)" className={cn(input, "text-xs")} />
    </div>
  );
}
function MultimediaView({ content }: ViewProps<MultimediaContent>) {
  const embed = embedUrl(content.url);
  if (!content.url) return <p className="text-foreground/40">No video set.</p>;
  return (
    <figure className="flex flex-col gap-2">
      {embed ? (
        <div className="aspect-video w-full overflow-hidden rounded-xl border border-border">
          <iframe src={embed} className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        </div>
      ) : (
        <a href={content.url} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
          Watch video ↗
        </a>
      )}
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

// ── shared editor for {id,title,body}[] item lists (accordion/tabs/process) ──
function ItemListEditor<T extends { id: string; title: string; body: string }>({
  items,
  onChange,
  addLabel,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  addLabel: string;
}) {
  function patch(id: string, p: Partial<T>) {
    onChange(items.map((it) => (it.id === id ? { ...it, ...p } : it)));
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((it) => (
        <div key={it.id} className="rounded-lg border border-border p-2">
          <div className="flex items-center gap-2">
            <input value={it.title} onChange={(e) => patch(it.id, { title: e.target.value } as Partial<T>)} placeholder="Title…" className={cn(input, "font-medium")} />
            <button onClick={() => onChange(items.filter((x) => x.id !== it.id))} className="shrink-0 rounded px-1 text-foreground/40 hover:text-destructive" title="Remove">
              <X className="size-4" />
            </button>
          </div>
          <textarea value={it.body} onChange={(e) => patch(it.id, { body: e.target.value } as Partial<T>)} rows={2} placeholder="Content…" className={cn(input, "mt-2 resize-none")} />
        </div>
      ))}
      <button
        onClick={() => onChange([...items, { id: uid(), title: "", body: "" } as T])}
        className="self-start rounded-md px-2 py-1 text-sm text-foreground/50 hover:bg-hover"
      >
        <Plus className="mr-1 inline size-3.5" /> {addLabel}
      </button>
    </div>
  );
}

// ── Accordion ─────────────────────────────────────────────────────────────────
function AccordionEdit({ content, save }: EditProps<AccordionContent>) {
  return <ItemListEditor items={content.items} onChange={(items) => save({ items })} addLabel="Add section" />;
}
function AccordionView({ content }: ViewProps<AccordionContent>) {
  const [open, setOpen] = useState<string | null>(content.items[0]?.id ?? null);
  if (content.items.length === 0) return <p className="text-foreground/40">No sections yet.</p>;
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {content.items.map((it: AccordionItem) => {
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

// ── Tabs ──────────────────────────────────────────────────────────────────────
function TabsEdit({ content, save }: EditProps<TabsContent>) {
  return <ItemListEditor items={content.items} onChange={(items) => save({ items })} addLabel="Add tab" />;
}
function TabsView({ content }: ViewProps<TabsContent>) {
  const [active, setActive] = useState<string | null>(content.items[0]?.id ?? null);
  if (content.items.length === 0) return <p className="text-foreground/40">No tabs yet.</p>;
  const current = content.items.find((it: TabItem) => it.id === active) ?? content.items[0];
  return (
    <div className="rounded-xl border border-border">
      <div className="flex flex-wrap gap-1 border-b border-border p-1.5">
        {content.items.map((it: TabItem) => (
          <button
            key={it.id}
            onClick={() => setActive(it.id)}
            className={cn("rounded-md px-3 py-1.5 text-sm font-medium", it.id === current.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-hover")}
          >
            {it.title || "Untitled"}
          </button>
        ))}
      </div>
      <div className="whitespace-pre-wrap p-4 text-[0.95rem] leading-relaxed text-foreground/90">{current.body}</div>
    </div>
  );
}

// ── Process (paged steps) ─────────────────────────────────────────────────────
function ProcessEdit({ content, save }: EditProps<ProcessContent>) {
  return <ItemListEditor items={content.steps} onChange={(steps) => save({ steps })} addLabel="Add step" />;
}
function ProcessView({ content }: ViewProps<ProcessContent>) {
  const [i, setI] = useState(0);
  if (content.steps.length === 0) return <p className="text-foreground/40">No steps yet.</p>;
  const step: ProcessStep = content.steps[Math.min(i, content.steps.length - 1)];
  return (
    <div className="rounded-xl border border-border p-5">
      <div className="mb-4 flex items-center gap-2">
        {content.steps.map((s: ProcessStep, idx: number) => (
          <button
            key={s.id}
            onClick={() => setI(idx)}
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
              idx === i ? "bg-accent text-accent-foreground" : idx < i ? "bg-accent/25 text-accent" : "bg-muted text-muted-foreground"
            )}
          >
            {idx + 1}
          </button>
        ))}
      </div>
      <h4 className="font-semibold">{step.title || `Step ${i + 1}`}</h4>
      <p className="mt-1.5 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-foreground/90">{step.body}</p>
      <div className="mt-4 flex items-center gap-2">
        <button onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0} className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-hover disabled:opacity-30">
          <ChevronLeft className="size-4" /> Back
        </button>
        <button
          onClick={() => setI((n) => Math.min(content.steps.length - 1, n + 1))}
          disabled={i === content.steps.length - 1}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-hover disabled:opacity-30"
        >
          Next <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

// ── Flashcards ────────────────────────────────────────────────────────────────
function FlashcardsEdit({ content, save }: EditProps<FlashcardsContent>) {
  function patch(id: string, p: Partial<Flashcard>) {
    save({ cards: content.cards.map((c) => (c.id === id ? { ...c, ...p } : c)) });
  }
  return (
    <div className="flex flex-col gap-2">
      {content.cards.map((c) => (
        <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
          <input value={c.front} onChange={(e) => patch(c.id, { front: e.target.value })} placeholder="Front…" className={cn(input, "text-sm")} />
          <input value={c.back} onChange={(e) => patch(c.id, { back: e.target.value })} placeholder="Back…" className={cn(input, "text-sm")} />
          <button onClick={() => save({ cards: content.cards.filter((x) => x.id !== c.id) })} className="shrink-0 rounded px-1 text-foreground/40 hover:text-destructive" title="Remove">
            <X className="size-4" />
          </button>
        </div>
      ))}
      <button
        onClick={() => save({ cards: [...content.cards, { id: uid(), front: "", back: "" }] })}
        className="self-start rounded-md px-2 py-1 text-sm text-foreground/50 hover:bg-hover"
      >
        <Plus className="mr-1 inline size-3.5" /> Add card
      </button>
    </div>
  );
}
function FlashcardsView({ content }: ViewProps<FlashcardsContent>) {
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  if (content.cards.length === 0) return <p className="text-foreground/40">No cards yet.</p>;
  function toggle(id: string) {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {content.cards.map((c: Flashcard) => {
        const isFlipped = flipped.has(c.id);
        return (
          <button
            key={c.id}
            onClick={() => toggle(c.id)}
            className={cn(
              "flex min-h-24 items-center justify-center rounded-xl border p-4 text-center text-sm font-medium transition-colors",
              isFlipped ? "border-accent bg-accent/8 text-foreground" : "border-border bg-surface hover:border-border-strong"
            )}
          >
            {isFlipped ? c.back || "(back)" : c.front || "(front)"}
          </button>
        );
      })}
    </div>
  );
}

// ── Knowledge check (single / multi / fill-in-the-blank) ─────────────────────
function KnowledgeCheckEdit({ content, save, objectives = [] }: EditProps<KnowledgeCheckContent>) {
  function patchOpt(id: string, p: Partial<KnowledgeCheckOption>) {
    save({ ...content, options: content.options.map((o) => (o.id === id ? { ...o, ...p } : o)) });
  }
  return (
    <div className="flex flex-col gap-3">
      <select
        value={content.questionType}
        onChange={(e) => save({ ...content, questionType: e.target.value as KnowledgeCheckType })}
        className="self-start rounded-md border border-border-strong bg-transparent px-2 py-1 text-xs"
      >
        {KNOWLEDGE_CHECK_TYPES.map((t) => (
          <option key={t} value={t}>{KNOWLEDGE_CHECK_TYPE_LABEL[t]}</option>
        ))}
      </select>

      <textarea
        value={content.question}
        onChange={(e) => save({ ...content, question: e.target.value })}
        rows={2}
        placeholder="Question…"
        className={cn(input, "resize-none font-medium")}
      />

      {content.questionType === "fill_blank" ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Accepted answers (any match counts):</span>
          <div className="flex flex-wrap gap-1.5">
            {content.acceptedAnswers.map((a, i) => (
              <span key={i} className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                {a}
                <button onClick={() => save({ ...content, acceptedAnswers: content.acceptedAnswers.filter((_, idx) => idx !== i) })} className="text-muted-foreground hover:text-destructive">
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <input
            placeholder="Type an accepted answer and press Enter…"
            className={cn(input, "text-sm")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const v = e.currentTarget.value.trim();
                if (v) { save({ ...content, acceptedAnswers: [...content.acceptedAnswers, v] }); e.currentTarget.value = ""; }
              }
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {content.questionType === "multi" ? "Check every correct answer:" : "Mark the correct answer:"}
          </span>
          {content.options.map((o) => (
            <div key={o.id} className="flex items-center gap-2">
              <button
                onClick={() => patchOpt(o.id, { correct: !o.correct })}
                title={o.correct ? "Correct answer" : "Mark correct"}
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center border",
                  content.questionType === "multi" ? "rounded" : "rounded-full",
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
      )}

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
  const type = content.questionType ?? "single";
  const [picked, setPicked] = useState<string | null>(null); // single
  const [checked, setChecked] = useState<Set<string>>(new Set()); // multi
  const [text, setText] = useState(""); // fill_blank
  const [submitted, setSubmitted] = useState(false);

  const isRight = (o: KnowledgeCheckOption) => o.correct;
  const correctIds = new Set(content.options.filter((o) => o.correct).map((o) => o.id));
  const multiCorrect =
    submitted && type === "multi" && checked.size === correctIds.size && [...checked].every((id) => correctIds.has(id));
  const fillCorrect =
    submitted && type === "fill_blank" && content.acceptedAnswers.some((a) => a.trim().toLowerCase() === text.trim().toLowerCase());

  function reset() {
    setPicked(null);
    setChecked(new Set());
    setText("");
    setSubmitted(false);
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="mb-3 flex items-start gap-2 font-medium">
        <CircleHelp className="mt-0.5 size-4.5 shrink-0 text-accent" /> {content.question || "Question"}
      </p>

      {type === "single" && (
        <div className="flex flex-col gap-2">
          {content.options.map((o) => {
            const answered = picked !== null;
            const chosen = picked === o.id;
            const style =
              answered && isRight(o)
                ? { borderColor: "var(--color-success)", backgroundColor: "color-mix(in srgb, var(--color-success) 8%, transparent)" }
                : answered && chosen && !isRight(o)
                  ? { borderColor: "var(--color-destructive)", backgroundColor: "color-mix(in srgb, var(--color-destructive) 8%, transparent)" }
                  : undefined;
            return (
              <button
                key={o.id}
                disabled={answered}
                onClick={() => setPicked(o.id)}
                style={style}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-hover disabled:cursor-default"
              >
                <span className="flex-1">{o.text}</span>
                {answered && isRight(o) && <Check className="size-4" style={{ color: "var(--color-success)" }} />}
                {answered && chosen && !isRight(o) && <X className="size-4" style={{ color: "var(--color-destructive)" }} />}
              </button>
            );
          })}
          {picked !== null && content.feedback && <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-foreground/80">{content.feedback}</p>}
          {picked !== null && (
            <button onClick={reset} className="mt-1 self-start text-xs text-muted-foreground hover:underline">Try again</button>
          )}
        </div>
      )}

      {type === "multi" && (
        <div className="flex flex-col gap-2">
          {content.options.map((o) => {
            const isChecked = checked.has(o.id);
            const style = submitted
              ? o.correct
                ? { borderColor: "var(--color-success)", backgroundColor: "color-mix(in srgb, var(--color-success) 8%, transparent)" }
                : isChecked
                  ? { borderColor: "var(--color-destructive)", backgroundColor: "color-mix(in srgb, var(--color-destructive) 8%, transparent)" }
                  : undefined
              : undefined;
            return (
              <button
                key={o.id}
                disabled={submitted}
                onClick={() =>
                  setChecked((prev) => {
                    const next = new Set(prev);
                    if (next.has(o.id)) next.delete(o.id);
                    else next.add(o.id);
                    return next;
                  })
                }
                style={style}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-hover disabled:cursor-default"
              >
                <span className={cn("flex size-4 shrink-0 items-center justify-center rounded border", isChecked ? "border-accent bg-accent text-accent-foreground" : "border-border-strong")}>
                  {isChecked && <Check className="size-3" />}
                </span>
                <span className="flex-1">{o.text}</span>
              </button>
            );
          })}
          {!submitted ? (
            <button onClick={() => setSubmitted(true)} disabled={checked.size === 0} className="mt-1 self-start rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-40">
              Submit
            </button>
          ) : (
            <>
              <p className={cn("text-sm font-medium", multiCorrect ? "" : "")} style={{ color: multiCorrect ? "var(--color-success)" : "var(--color-destructive)" }}>
                {multiCorrect ? "Correct!" : "Not quite."}
              </p>
              {content.feedback && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground/80">{content.feedback}</p>}
              <button onClick={reset} className="self-start text-xs text-muted-foreground hover:underline">Try again</button>
            </>
          )}
        </div>
      )}

      {type === "fill_blank" && (
        <div className="flex flex-col gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={submitted}
            placeholder="Type your answer…"
            className={cn(input, "text-sm")}
            style={
              submitted
                ? {
                    borderColor: fillCorrect ? "var(--color-success)" : "var(--color-destructive)",
                    backgroundColor: `color-mix(in srgb, var(${fillCorrect ? "--color-success" : "--color-destructive"}) 8%, transparent)`,
                  }
                : undefined
            }
          />
          {!submitted ? (
            <button onClick={() => setSubmitted(true)} disabled={!text.trim()} className="self-start rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-40">
              Submit
            </button>
          ) : (
            <>
              <p style={{ color: fillCorrect ? "var(--color-success)" : "var(--color-destructive)" }} className="text-sm font-medium">
                {fillCorrect ? "Correct!" : "Not quite."}
              </p>
              {content.feedback && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground/80">{content.feedback}</p>}
              <button onClick={reset} className="self-start text-xs text-muted-foreground hover:underline">Try again</button>
            </>
          )}
        </div>
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
  statement: { icon: QuoteIcon, Edit: StatementEdit, View: StatementView },
  quote: { icon: QuoteIcon, Edit: QuoteEdit, View: QuoteView },
  list: { icon: ListIcon, Edit: ListEdit, View: ListView },
  image: { icon: ImageIcon, Edit: ImageEdit, View: ImageView },
  multimedia: { icon: Video, Edit: MultimediaEdit, View: MultimediaView },
  divider: { icon: Minus, Edit: DividerEdit, View: DividerView },
  accordion: { icon: Rows3, Edit: AccordionEdit, View: AccordionView },
  tabs: { icon: LayoutPanelTop, Edit: TabsEdit, View: TabsView },
  process: { icon: ListOrdered, Edit: ProcessEdit, View: ProcessView },
  flashcards: { icon: Layers, Edit: FlashcardsEdit, View: FlashcardsView },
  knowledge_check: { icon: CircleHelp, Edit: KnowledgeCheckEdit, View: KnowledgeCheckView },
};
