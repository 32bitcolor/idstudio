"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import { markdownToDoc } from "@/lib/markdown";

// The assistant's Markdown, rendered with the same parser that turns Markdown into the
// app's rich text (lib/markdown.ts), so the panel shows what a card would.

type Node = { type: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: Node[] };

function safeHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  return /^(https?:|mailto:|\/)/i.test(href) ? href : null;
}

function inline(nodes: Node[] | undefined): ReactNode {
  return (nodes ?? []).map((n, i) => {
    if (n.type === "hardBreak") return <br key={i} />;
    let el: ReactNode = n.text ?? "";
    for (const m of n.marks ?? []) {
      if (m.type === "bold") el = <strong>{el}</strong>;
      else if (m.type === "italic") el = <em>{el}</em>;
      else if (m.type === "strike") el = <s>{el}</s>;
      else if (m.type === "code") el = <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{el}</code>;
      else if (m.type === "link") {
        const href = safeHref(m.attrs?.href);
        if (href) {
          const internal = href.startsWith("/") || (typeof window !== "undefined" && href.startsWith(window.location.origin));
          el = (
            <a href={href} className="font-medium text-primary underline underline-offset-2" {...(internal ? {} : { target: "_blank", rel: "noreferrer" })}>
              {el}
            </a>
          );
        }
      }
    }
    return <Fragment key={i}>{el}</Fragment>;
  });
}

function block(n: Node, i: number): ReactNode {
  switch (n.type) {
    case "heading":
      return (
        <p key={i} className="mt-3 font-semibold first:mt-0">
          {inline(n.content)}
        </p>
      );
    case "bulletList":
      return (
        <ul key={i} className="my-1.5 list-disc space-y-0.5 pl-5">
          {n.content?.map(block)}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={i} className="my-1.5 list-decimal space-y-0.5 pl-5" start={Number(n.attrs?.start ?? 1)}>
          {n.content?.map(block)}
        </ol>
      );
    case "listItem":
      return <li key={i}>{n.content?.map((c, k) => (c.type === "paragraph" ? <Fragment key={k}>{inline(c.content)}</Fragment> : block(c, k)))}</li>;
    case "blockquote":
      return (
        <blockquote key={i} className="my-1.5 border-l-2 border-border pl-3 text-muted-foreground">
          {n.content?.map(block)}
        </blockquote>
      );
    case "codeBlock":
      return (
        <pre key={i} className="my-1.5 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs">
          {n.content?.map((c) => c.text).join("")}
        </pre>
      );
    default:
      return (
        <p key={i} className="my-1.5 first:mt-0 last:mb-0">
          {inline(n.content)}
        </p>
      );
  }
}

export function MarkdownView({ text }: { text: string }) {
  const doc = useMemo(() => markdownToDoc(text) as { content: Node[] }, [text]);
  return <div className="break-words text-sm leading-relaxed">{doc.content.map(block)}</div>;
}
