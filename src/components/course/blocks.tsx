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
  MapPin,
  ArrowDownUp,
  type LucideIcon,
} from "lucide-react";

import { requestCourseImageUpload, getCourseImageViewUrl } from "@/app/actions/courses";
import { DescriptionEditor } from "@/components/board/description-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
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
  LabeledGraphicContent,
  LabeledGraphicMarker,
  SortContent,
  SortItem,
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
      <Select
        value={content.level}
        onChange={(e) => save({ ...content, level: Number(e.target.value) as 1 | 2 | 3 })}
        className="w-auto py-1 text-xs"
        aria-label="Heading level"
      >
        <option value={1}>H1</option>
        <option value={2}>H2</option>
        <option value={3}>H3</option>
      </Select>
      <Input
        value={content.text}
        onChange={(e) => save({ ...content, text: e.target.value })}
        placeholder="Section heading…"
        className="font-semibold"
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
    <Textarea
      value={content.text}
      onChange={(e) => save({ text: e.target.value })}
      rows={2}
      placeholder="A short, emphasized statement…"
      className="min-h-0 resize-none text-lg font-medium"
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
      <Textarea
        value={content.quote}
        onChange={(e) => save({ ...content, quote: e.target.value })}
        rows={3}
        placeholder="Quote…"
        className="min-h-0 resize-none italic"
      />
      <Input
        value={content.attribution}
        onChange={(e) => save({ ...content, attribution: e.target.value })}
        placeholder="Attribution (optional)…"
        className="text-sm"
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
      <Select
        value={content.style}
        onChange={(e) => save({ ...content, style: e.target.value as ListStyle })}
        className="w-auto self-start py-1 text-xs"
      >
        <option value="bullet">Bulleted</option>
        <option value="number">Numbered</option>
        <option value="check">Checked</option>
      </Select>
      {content.items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input value={it} onChange={(e) => patch(i, e.target.value)} placeholder="List item…" className="text-sm" />
          <button onClick={() => save({ ...content, items: content.items.filter((_, idx) => idx !== i) })} className="shrink-0 rounded px-1 text-foreground/40 hover:text-destructive" title="Remove">
            <X className="size-4" />
          </button>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="self-start" onClick={() => save({ ...content, items: [...content.items, ""] })}>
        <Plus className="size-3.5" /> Add item
      </Button>
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
/** Shared upload-or-URL controls for any block backed by an S3 key + url pair
 * (Image, Labeled Graphic). Renders only the source picker, not the preview —
 * each caller renders the resolved `src` (via useImageSrc) however it needs. */
function ImageSourceControls({
  courseId,
  keyVal,
  url,
  onChange,
}: {
  courseId?: string;
  keyVal: string | null;
  url: string;
  onChange: (next: { key: string | null; url: string }) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlMode, setUrlMode] = useState(!keyVal && !!url);
  const fileRef = useRef<HTMLInputElement>(null);

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
      onChange({ key: res.key, url: "" });
    } catch {
      setError("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setUrlMode(false)}
          className={cn(!urlMode ? "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground" : "bg-muted text-muted-foreground")}
        >
          <Upload className="size-3.5" /> Upload
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setUrlMode(true)}
          className={cn(urlMode ? "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground" : "bg-muted text-muted-foreground")}
        >
          <Link2 className="size-3.5" /> Use a URL
        </Button>
      </div>

      {urlMode ? (
        <Input
          value={keyVal ? "" : url}
          onChange={(e) => onChange({ key: null, url: e.target.value })}
          placeholder="Image URL (https://…)"
        />
      ) : (
        <div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || !courseId}
            className="text-muted-foreground"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {uploading ? "Uploading…" : "Choose an image…"}
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ImageEdit({ content, save, courseId }: EditProps<ImageContent>) {
  const src = useImageSrc(courseId, content.key, content.url);
  return (
    <div className="flex flex-col gap-2">
      <ImageSourceControls courseId={courseId} keyVal={content.key} url={content.url} onChange={(next) => save({ ...content, ...next })} />
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={content.alt} className="max-h-56 w-auto rounded-lg border border-border" />
      )}
      <div className="flex gap-2">
        <Input value={content.alt} onChange={(e) => save({ ...content, alt: e.target.value })} placeholder="Alt text (accessibility)" className="text-xs" />
        <Input value={content.caption} onChange={(e) => save({ ...content, caption: e.target.value })} placeholder="Caption (optional)" className="text-xs" />
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

// ── Labeled graphic (image + clickable hotspots) ──────────────────────────────
function LabeledGraphicEdit({ content, save, courseId }: EditProps<LabeledGraphicContent>) {
  const src = useImageSrc(courseId, content.key, content.url);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);

  function addMarkerAt(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
    const marker: LabeledGraphicMarker = { id: uid(), x, y, title: "", body: "" };
    save({ ...content, markers: [...content.markers, marker] });
    setActiveMarker(marker.id);
  }
  function patchMarker(id: string, p: Partial<LabeledGraphicMarker>) {
    save({ ...content, markers: content.markers.map((m) => (m.id === id ? { ...m, ...p } : m)) });
  }
  function removeMarker(id: string) {
    save({ ...content, markers: content.markers.filter((m) => m.id !== id) });
    if (activeMarker === id) setActiveMarker(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <ImageSourceControls courseId={courseId} keyVal={content.key} url={content.url} onChange={(next) => save({ ...content, ...next })} />
      {src && (
        <>
          <div
            onClick={addMarkerAt}
            title="Click to place a marker"
            className="relative cursor-crosshair select-none overflow-hidden rounded-lg border border-border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={content.alt} className="block w-full" draggable={false} />
            {content.markers.map((m, i) => (
              <button
                key={m.id}
                onClick={(e) => { e.stopPropagation(); setActiveMarker(activeMarker === m.id ? null : m.id); }}
                style={{ left: `${m.x}%`, top: `${m.y}%` }}
                className={cn(
                  "absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-bold shadow",
                  activeMarker === m.id ? "bg-foreground text-background" : "bg-accent text-accent-foreground"
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Click the image to add a marker; click a marker below to edit it.</p>
        </>
      )}
      <Input value={content.alt} onChange={(e) => save({ ...content, alt: e.target.value })} placeholder="Alt text (accessibility)" className="text-xs" />
      {content.markers.length > 0 && (
        <div className="flex flex-col gap-2">
          {content.markers.map((m, i) => (
            <div key={m.id} className={cn("rounded-lg border p-2", activeMarker === m.id ? "border-accent" : "border-border")}>
              <div className="flex items-center gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">{i + 1}</span>
                <Input value={m.title} onChange={(e) => patchMarker(m.id, { title: e.target.value })} placeholder="Marker title…" className="text-sm" />
                <button onClick={() => removeMarker(m.id)} className="shrink-0 rounded px-1 text-foreground/40 hover:text-destructive" title="Remove marker"><X className="size-4" /></button>
              </div>
              <Textarea value={m.body} onChange={(e) => patchMarker(m.id, { body: e.target.value })} rows={2} placeholder="Marker detail…" className="mt-2 min-h-0 resize-none" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function LabeledGraphicView({ content, courseId }: ViewProps<LabeledGraphicContent>) {
  const src = useImageSrc(courseId, content.key, content.url);
  const [open, setOpen] = useState<string | null>(null);
  if (!src) return <p className="text-foreground/40">No image set.</p>;
  return (
    <div className="relative select-none overflow-hidden rounded-xl border border-border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={content.alt} className="block w-full" />
      {content.markers.map((m, i) => (
        <div key={m.id} className="absolute" style={{ left: `${m.x}%`, top: `${m.y}%` }}>
          <button
            onClick={() => setOpen(open === m.id ? null : m.id)}
            className={cn(
              "flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-bold shadow transition-colors",
              open === m.id ? "bg-foreground text-background" : "bg-accent text-accent-foreground"
            )}
          >
            {i + 1}
          </button>
          {open === m.id && (
            <div className="absolute z-10 mt-1 w-56 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-left shadow-lg">
              <p className="text-sm font-semibold">{m.title || `Marker ${i + 1}`}</p>
              {m.body && <p className="mt-1 text-xs text-muted-foreground">{m.body}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Multimedia (video embed) ──────────────────────────────────────────────────
function MultimediaEdit({ content, save }: EditProps<MultimediaContent>) {
  const embed = embedUrl(content.url);
  return (
    <div className="flex flex-col gap-2">
      <Input
        value={content.url}
        onChange={(e) => save({ ...content, url: e.target.value })}
        placeholder="YouTube or Vimeo URL…"
      />
      {content.url && !embed && <p className="text-xs text-muted-foreground">Paste a YouTube or Vimeo link to embed it.</p>}
      {embed && (
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-border">
          <iframe src={embed} className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        </div>
      )}
      <Input value={content.caption} onChange={(e) => save({ ...content, caption: e.target.value })} placeholder="Caption (optional)" className="text-xs" />
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
            <Input value={it.title} onChange={(e) => patch(it.id, { title: e.target.value } as Partial<T>)} placeholder="Title…" className="font-medium" />
            <button onClick={() => onChange(items.filter((x) => x.id !== it.id))} className="shrink-0 rounded px-1 text-foreground/40 hover:text-destructive" title="Remove">
              <X className="size-4" />
            </button>
          </div>
          <Textarea value={it.body} onChange={(e) => patch(it.id, { body: e.target.value } as Partial<T>)} rows={2} placeholder="Content…" className="mt-2 min-h-0 resize-none" />
        </div>
      ))}
      <Button variant="ghost" size="sm" className="self-start" onClick={() => onChange([...items, { id: uid(), title: "", body: "" } as T])}>
        <Plus className="size-3.5" /> {addLabel}
      </Button>
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
          <Input value={c.front} onChange={(e) => patch(c.id, { front: e.target.value })} placeholder="Front…" className="text-sm" />
          <Input value={c.back} onChange={(e) => patch(c.id, { back: e.target.value })} placeholder="Back…" className="text-sm" />
          <button onClick={() => save({ cards: content.cards.filter((x) => x.id !== c.id) })} className="shrink-0 rounded px-1 text-foreground/40 hover:text-destructive" title="Remove">
            <X className="size-4" />
          </button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => save({ cards: [...content.cards, { id: uid(), front: "", back: "" }] })}
      >
        <Plus className="size-3.5" /> Add card
      </Button>
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
      <Select
        value={content.questionType}
        onChange={(e) => save({ ...content, questionType: e.target.value as KnowledgeCheckType })}
        className="w-auto self-start py-1 text-xs"
      >
        {KNOWLEDGE_CHECK_TYPES.map((t) => (
          <option key={t} value={t}>{KNOWLEDGE_CHECK_TYPE_LABEL[t]}</option>
        ))}
      </Select>

      <Textarea
        value={content.question}
        onChange={(e) => save({ ...content, question: e.target.value })}
        rows={2}
        placeholder="Question…"
        className="min-h-0 resize-none font-medium"
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
          <Input
            placeholder="Type an accepted answer and press Enter…"
            className="text-sm"
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
              >
                <Check className="size-3" />
              </button>
              <Input value={o.text} onChange={(e) => patchOpt(o.id, { text: e.target.value })} placeholder="Answer option…" className="text-sm" />
              <button onClick={() => save({ ...content, options: content.options.filter((x) => x.id !== o.id) })} className="shrink-0 rounded px-1 text-foreground/40 hover:text-destructive" title="Remove option">
                <X className="size-4" />
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => save({ ...content, options: [...content.options, { id: uid(), text: "", correct: false }] })}
          >
            <Plus className="size-3.5" /> Add option
          </Button>
        </div>
      )}

      <Textarea
        value={content.feedback}
        onChange={(e) => save({ ...content, feedback: e.target.value })}
        rows={2}
        placeholder="Feedback shown after answering (optional)…"
        className="min-h-0 resize-none text-sm"
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
            return (
              <button
                key={o.id}
                disabled={answered}
                onClick={() => setPicked(o.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-hover disabled:cursor-default",
                  answered && isRight(o)
                    ? "border-success bg-success/8"
                    : answered && chosen && !isRight(o)
                      ? "border-destructive bg-destructive/8"
                      : "border-border"
                )}
              >
                <span className="flex-1">{o.text}</span>
                {answered && isRight(o) && <Check className="size-4 text-success" />}
                {answered && chosen && !isRight(o) && <X className="size-4 text-destructive" />}
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
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-hover disabled:cursor-default",
                  submitted
                    ? o.correct
                      ? "border-success bg-success/8"
                      : isChecked
                        ? "border-destructive bg-destructive/8"
                        : "border-border"
                    : "border-border"
                )}
              >
                <span className={cn("flex size-4 shrink-0 items-center justify-center rounded border", isChecked ? "border-accent bg-accent text-accent-foreground" : "border-border-strong")}>
                  {isChecked && <Check className="size-3" />}
                </span>
                <span className="flex-1">{o.text}</span>
              </button>
            );
          })}
          {!submitted ? (
            <Button size="sm" className="mt-1 self-start" onClick={() => setSubmitted(true)} disabled={checked.size === 0}>
              Submit
            </Button>
          ) : (
            <>
              <p className={cn("text-sm font-medium", multiCorrect ? "text-success" : "text-destructive")}>
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
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={submitted}
            placeholder="Type your answer…"
            className={cn("text-sm", submitted && (fillCorrect ? "border-success bg-success/8" : "border-destructive bg-destructive/8"))}
          />
          {!submitted ? (
            <Button size="sm" className="self-start" onClick={() => setSubmitted(true)} disabled={!text.trim()}>
              Submit
            </Button>
          ) : (
            <>
              <p className={cn("text-sm font-medium", fillCorrect ? "text-success" : "text-destructive")}>
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

// ── Sorting activity (learner assigns items to categories) ───────────────────
function SortEdit({ content, save }: EditProps<SortContent>) {
  function patchCategory(id: string, name: string) {
    save({ ...content, categories: content.categories.map((c) => (c.id === id ? { ...c, name } : c)) });
  }
  function removeCategory(id: string) {
    save({
      ...content,
      categories: content.categories.filter((c) => c.id !== id),
      items: content.items.map((i) => (i.categoryId === id ? { ...i, categoryId: null } : i)),
    });
  }
  function patchItem(id: string, p: Partial<SortItem>) {
    save({ ...content, items: content.items.map((i) => (i.id === id ? { ...i, ...p } : i)) });
  }
  function removeItem(id: string) {
    save({ ...content, items: content.items.filter((i) => i.id !== id) });
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">Categories</p>
        {content.categories.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <Input value={c.name} onChange={(e) => patchCategory(c.id, e.target.value)} placeholder="Category name…" className="text-sm" />
            <button onClick={() => removeCategory(c.id)} className="shrink-0 rounded px-1 text-foreground/40 hover:text-destructive" title="Remove category">
              <X className="size-4" />
            </button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => save({ ...content, categories: [...content.categories, { id: uid(), name: "" }] })}
        >
          <Plus className="size-3.5" /> Add category
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">Items</p>
        {content.items.map((i) => (
          <div key={i.id} className="flex items-center gap-2">
            <Input value={i.text} onChange={(e) => patchItem(i.id, { text: e.target.value })} placeholder="Item text…" className="text-sm" />
            <Select
              value={i.categoryId ?? ""}
              onChange={(e) => patchItem(i.id, { categoryId: e.target.value || null })}
              className="w-40 shrink-0 text-sm"
            >
              <option value="">Correct category…</option>
              {content.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name || "(untitled)"}</option>
              ))}
            </Select>
            <button onClick={() => removeItem(i.id)} className="shrink-0 rounded px-1 text-foreground/40 hover:text-destructive" title="Remove item">
              <X className="size-4" />
            </button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => save({ ...content, items: [...content.items, { id: uid(), text: "", categoryId: null }] })}
        >
          <Plus className="size-3.5" /> Add item
        </Button>
      </div>
      <Textarea
        value={content.feedback}
        onChange={(e) => save({ ...content, feedback: e.target.value })}
        rows={2}
        placeholder="Feedback shown after checking (optional)…"
        className="min-h-0 resize-none text-sm"
      />
    </div>
  );
}

function SortView({ content }: ViewProps<SortContent>) {
  const [placement, setPlacement] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(content.items.map((i) => [i.id, null]))
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  if (content.categories.length === 0 || content.items.length === 0) {
    return <p className="text-foreground/40">No sorting items yet.</p>;
  }

  function place(itemId: string, categoryId: string | null) {
    if (checked) return;
    setPlacement((prev) => ({ ...prev, [itemId]: categoryId }));
    setSelected(null);
  }
  function reset() {
    setPlacement(Object.fromEntries(content.items.map((i) => [i.id, null])));
    setSelected(null);
    setChecked(false);
  }

  const unsorted = content.items.filter((i) => !placement[i.id]);
  const allPlaced = unsorted.length === 0;
  const correctCount = content.items.filter((i) => placement[i.id] === i.categoryId).length;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowDownUp className="size-4" /> Select an item, then select the category it belongs to.
      </p>

      <div className="mb-4 flex flex-wrap gap-2 rounded-lg border border-dashed border-border p-3 min-h-12">
        {unsorted.length === 0 && <span className="text-xs text-foreground/40">All items sorted.</span>}
        {unsorted.map((i) => (
          <button
            key={i.id}
            onClick={() => setSelected(selected === i.id ? null : i.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              selected === i.id ? "border-accent bg-accent/15 text-foreground" : "border-border-strong hover:bg-hover"
            )}
          >
            {i.text || "(item)"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {content.categories.map((c) => {
          const inCat = content.items.filter((i) => placement[i.id] === c.id);
          return (
            <div
              key={c.id}
              onClick={() => selected && place(selected, c.id)}
              className={cn(
                "flex min-h-24 flex-col gap-1.5 rounded-lg border p-3",
                selected ? "cursor-pointer border-accent/50 hover:border-accent" : "border-border"
              )}
            >
              <p className="text-xs font-semibold text-muted-foreground">{c.name || "(category)"}</p>
              {inCat.map((i) => {
                return (
                  <button
                    key={i.id}
                    onClick={(e) => { e.stopPropagation(); place(i.id, null); }}
                    disabled={checked}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md border bg-surface px-2 py-1 text-left text-sm disabled:cursor-default",
                      checked
                        ? i.categoryId === c.id
                          ? "border-success bg-success/8"
                          : "border-destructive bg-destructive/8"
                        : "border-border-strong"
                    )}
                  >
                    <span>{i.text}</span>
                    {checked && (i.categoryId === c.id ? <Check className="size-3.5 shrink-0 text-success" /> : <X className="size-3.5 shrink-0 text-destructive" />)}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {!checked ? (
        <Button size="sm" className="mt-4 self-start" onClick={() => setChecked(true)} disabled={!allPlaced}>
          Check answers
        </Button>
      ) : (
        <div className="mt-4 flex flex-col items-start gap-2">
          <p className={cn("text-sm font-medium", correctCount === content.items.length ? "text-success" : "text-destructive")}>
            {correctCount} of {content.items.length} correct
          </p>
          {content.feedback && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground/80">{content.feedback}</p>}
          <button onClick={reset} className="text-xs text-muted-foreground hover:underline">Try again</button>
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
  labeled_graphic: { icon: MapPin, Edit: LabeledGraphicEdit, View: LabeledGraphicView },
  sort: { icon: ArrowDownUp, Edit: SortEdit, View: SortView },
  knowledge_check: { icon: CircleHelp, Edit: KnowledgeCheckEdit, View: KnowledgeCheckView },
};
