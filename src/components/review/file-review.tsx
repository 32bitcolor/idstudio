"use client";

import { useEffect, useRef, useState } from "react";
import { Download, MessageSquarePlus } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";

import type { FileAnchor } from "@/lib/review-anchor";
import { cn } from "@/lib/utils";

// Reviewing a PDF or an image (docs/REVIEW-LINKS.md, phase 3). PDFs are drawn by pdf.js
// into canvases: no text layer, no annotation layer, no scripts — we render the file,
// we never run it. Click a page to drop a pin, drag to mark a region; each comment
// thread shows as a numbered marker where it was left.

export type ReviewFileView = {
  url: string; // where this viewer may read the bytes (member API route or guest route)
  fileName: string;
  mimeType: string;
};

export type FilePin = { threadId: string; number: number; anchor: FileAnchor; open: boolean; label: string };

const PDFJS = "/vendor/pdfjs";
const MIN_DRAG = 0.015; // a drag smaller than this (fraction of the page) is a click

export const pinDomId = (threadId: string) => `pin-${threadId}`;
export const pageDomId = (page: number) => `file-page-${page}`;

export function FileReview({
  file,
  pins,
  canComment,
  composingAnchor,
  flash,
  onCompose,
  onSelectPin,
  composer,
}: {
  file: ReviewFileView;
  pins: FilePin[];
  canComment: boolean;
  composingAnchor: FileAnchor | null;
  flash: string | null;
  onCompose: (anchor: FileAnchor) => void;
  onSelectPin: (threadId: string) => void;
  /** Rendered under the page being commented on. */
  composer: React.ReactNode;
}) {
  const isPdf = file.mimeType === "application/pdf";
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [ratio, setRatio] = useState<number | null>(null); // first page's height / width, for placeholders
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPdf) return;
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.mjs`;
        const loading = pdfjs.getDocument({
          url: file.url,
          enableXfa: false,
          cMapUrl: `${PDFJS}/cmaps/`,
          standardFontDataUrl: `${PDFJS}/standard_fonts/`,
          wasmUrl: `${PDFJS}/wasm/`,
          iccUrl: `${PDFJS}/iccs/`,
        });
        task = loading;
        const loaded = await loading.promise;
        const first = await loaded.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        if (cancelled) return;
        setRatio(vp.height / vp.width);
        setDoc(loaded);
      } catch {
        if (!cancelled) setError("This PDF couldn't be displayed. You can still download it and comment on the round as a whole.");
      }
    })();
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [file.url, isPdf]);

  const pages = isPdf ? (doc ? Array.from({ length: doc.numPages }, (_, i) => i + 1) : []) : [1];
  const pinsOn = (page: number) => pins.filter((p) => p.anchor.page === page);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 truncate text-sm font-semibold">
          {file.fileName}
          {isPdf && doc && (
            <span className="font-normal text-muted-foreground"> · {doc.numPages} page{doc.numPages === 1 ? "" : "s"}</span>
          )}
        </h2>
        <a
          href={`${file.url}?download`}
          className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-hover hover:text-foreground"
        >
          <Download className="size-3.5" aria-hidden="true" /> Download
        </a>
      </div>
      {canComment && (
        <p className="text-xs text-muted-foreground">
          Click anywhere on the {isPdf ? "page" : "image"} to pin a comment, or drag to mark an area.
        </p>
      )}

      <div ref={wrap} className="flex min-w-0 flex-col gap-4">
        {error && (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{error}</p>
        )}
        {isPdf && !doc && !error && (
          <div className="flex aspect-[8.5/11] w-full animate-pulse items-center justify-center rounded-lg border border-border bg-surface text-sm text-muted-foreground">
            Loading PDF…
          </div>
        )}
        {width > 0 &&
          pages.map((n) => {
            const composingHere = composingAnchor?.page === n;
            return (
              <section key={n} id={pageDomId(n)} aria-label={isPdf ? `Page ${n}` : "Image"} className="flex scroll-mt-20 flex-col gap-2">
                {isPdf && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">Page {n}</span>
                    {canComment && (
                      <button
                        type="button"
                        onClick={() => onCompose({ kind: "file_region", page: n, x: 0, y: 0, w: 1, h: 1 })}
                        className="ml-auto inline-flex h-6 items-center gap-1 rounded px-1.5 font-medium outline-none hover:bg-hover hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        <MessageSquarePlus className="size-3.5" aria-hidden="true" /> Comment on page {n}
                      </button>
                    )}
                  </div>
                )}
                <Surface
                  page={n}
                  width={width}
                  canComment={canComment}
                  pins={pinsOn(n)}
                  pending={composingHere ? composingAnchor : null}
                  flash={flash}
                  onCompose={onCompose}
                  onSelectPin={onSelectPin}
                >
                  {isPdf ? (
                    doc && <PdfPage doc={doc} page={n} width={width} ratio={ratio ?? 11 / 8.5} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- private, auth-gated bytes; next/image can't fetch them
                    <img src={file.url} alt={file.fileName} className="block h-auto w-full select-none" draggable={false} />
                  )}
                </Surface>
                {composingHere && composer}
              </section>
            );
          })}
      </div>
    </div>
  );
}

/** The page (or image) plus its interaction overlay: pins, regions, and the drag-to-mark
 *  gesture. Coordinates are stored as fractions of the page, so markers stay put at any width. */
function Surface({
  page,
  width,
  canComment,
  pins,
  pending,
  flash,
  onCompose,
  onSelectPin,
  children,
}: {
  page: number;
  width: number;
  canComment: boolean;
  pins: FilePin[];
  pending: FileAnchor | null;
  flash: string | null;
  onCompose: (anchor: FileAnchor) => void;
  onSelectPin: (threadId: string) => void;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  function frac(e: React.PointerEvent) {
    const r = box.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  }

  return (
    <div
      ref={box}
      style={{ maxWidth: width }}
      className={cn(
        "relative w-full overflow-hidden rounded-md border border-border bg-white shadow-xs",
        canComment && "cursor-crosshair touch-pan-y",
      )}
      onPointerDown={(e) => {
        if (!canComment || e.button !== 0 || (e.target as HTMLElement).closest("[data-pin]")) return;
        const p = frac(e);
        setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag) return;
        const p = frac(e);
        setDrag({ ...drag, x1: p.x, y1: p.y });
      }}
      onPointerUp={() => {
        if (!drag) return;
        const x = Math.min(drag.x0, drag.x1);
        const y = Math.min(drag.y0, drag.y1);
        const w = Math.abs(drag.x1 - drag.x0);
        const h = Math.abs(drag.y1 - drag.y0);
        setDrag(null);
        if (w < MIN_DRAG && h < MIN_DRAG) onCompose({ kind: "file_point", page, x: drag.x0, y: drag.y0 });
        else onCompose({ kind: "file_region", page, x, y, w: Math.max(w, MIN_DRAG), h: Math.max(h, MIN_DRAG) });
      }}
      onPointerCancel={() => setDrag(null)}
    >
      {children}
      {drag && (
        <span
          className="pointer-events-none absolute border-2 border-dashed border-accent bg-accent/10"
          style={box2css(Math.min(drag.x0, drag.x1), Math.min(drag.y0, drag.y1), Math.abs(drag.x1 - drag.x0), Math.abs(drag.y1 - drag.y0))}
        />
      )}
      {pending && !isWholePage(pending) && <Marker anchor={pending} label="New comment" pending />}
      {pins.map((p) =>
        isWholePage(p.anchor) ? null : (
          <Marker
            key={p.threadId}
            anchor={p.anchor}
            number={p.number}
            label={p.label}
            dim={!p.open}
            flash={flash === pinDomId(p.threadId)}
            id={pinDomId(p.threadId)}
            onClick={() => onSelectPin(p.threadId)}
          />
        ),
      )}
    </div>
  );
}

function isWholePage(a: FileAnchor) {
  return a.kind === "file_region" && a.x === 0 && a.y === 0 && a.w === 1 && a.h === 1;
}

function box2css(x: number, y: number, w: number, h: number): React.CSSProperties {
  return { left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` };
}

function Marker({
  anchor,
  number,
  label,
  pending,
  dim,
  flash,
  id,
  onClick,
}: {
  anchor: FileAnchor;
  number?: number;
  label: string;
  pending?: boolean;
  dim?: boolean;
  flash?: boolean;
  id?: string;
  onClick?: () => void;
}) {
  const dot = (
    <button
      type="button"
      id={id}
      data-pin
      onClick={onClick}
      aria-label={label}
      title={label}
      tabIndex={pending ? -1 : 0}
      className={cn(
        "flex size-6 items-center justify-center rounded-full rounded-bl-none border-2 border-white text-[11px] font-bold shadow-md outline-none transition-transform focus-visible:ring-[3px] focus-visible:ring-ring/60",
        pending ? "bg-accent text-accent-foreground" : dim ? "bg-muted-foreground text-white" : "bg-warning text-white",
        flash && "scale-125 ring-4 ring-accent/40",
      )}
    >
      {number ?? "+"}
    </button>
  );
  if (anchor.kind === "file_point") {
    // The pin's point (bottom-left corner) sits exactly on the spot clicked.
    return (
      <span className="absolute" style={{ left: `${anchor.x * 100}%`, top: `${anchor.y * 100}%`, transform: "translate(0, -100%)" }}>
        {dot}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "pointer-events-none absolute rounded-sm border-2",
        pending ? "border-dashed border-accent bg-accent/10" : dim ? "border-muted-foreground/60" : "border-warning bg-warning/10",
        flash && "ring-4 ring-accent/40",
      )}
      style={box2css(anchor.x, anchor.y, anchor.w, anchor.h)}
    >
      <span className="pointer-events-auto absolute -top-3 -left-3">{dot}</span>
    </span>
  );
}

/** One PDF page, drawn into a canvas once it scrolls near the viewport (long exports
 *  have hundreds of pages), and redrawn when the available width changes. */
function PdfPage({ doc, page, width, ratio }: { doc: PDFDocumentProxy; page: number; width: number; ratio: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(page <= 2);
  const [height, setHeight] = useState(width * ratio);

  useEffect(() => {
    if (near || !canvas.current) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), {
      rootMargin: "800px 0px",
    });
    io.observe(canvas.current);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near) return;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    let stale = false;
    (async () => {
      const p = await doc.getPage(page);
      if (stale || !canvas.current) return;
      const base = p.getViewport({ scale: 1 });
      const scale = width / base.width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = p.getViewport({ scale: scale * dpr });
      const c = canvas.current;
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      setHeight(base.height * scale);
      task = p.render({ canvas: c, viewport: vp });
      await task.promise.catch(() => {});
    })();
    return () => {
      stale = true;
      task?.cancel();
    };
  }, [doc, page, width, near]);

  return <canvas ref={canvas} className="block w-full select-none" style={{ height }} aria-hidden="true" />;
}

/** The element's content width, kept current as the layout changes. The first
 *  measurement applies at once; later ones are debounced so a window drag doesn't
 *  redraw every page on every frame. */
function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    let first = true;
    const ro = new ResizeObserver(([e]) => {
      const next = Math.min(Math.round(e.contentRect.width), 1100);
      clearTimeout(t);
      const apply = () => setW((prev) => (Math.abs(prev - next) > 4 ? next : prev));
      if (first) {
        first = false;
        apply();
      } else t = setTimeout(apply, 150);
    });
    ro.observe(el);
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, [ref]);
  return w;
}
