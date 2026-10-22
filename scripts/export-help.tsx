// Writes the in-app Help (src/components/help) to Markdown in docs/help/, so the same
// guides read on GitHub. The app is the source of truth: edit the topic components,
// then run `npm run help:export`. `npm run help:check` fails if the files are stale.
//
// It walks each topic's React element tree instead of rendering HTML, so it only has
// to know the handful of components help pages are built from (help/prose.tsx).
import * as React from "react";
import { mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { HELP_TOPICS, type HelpGroup } from "@/components/help/registry";
import { Lead, H2, H3, P, UL, LI, Steps, Callout, DefList, Def, UI, Table } from "@/components/help/prose";

const OUT = join(process.cwd(), "docs/help");
const CALLOUT_LABEL = { tip: "Tip", note: "Note", warning: "Heads up" } as const;

type El = React.ReactElement<Record<string, unknown> & { children?: React.ReactNode }>;

/** /help/<slug> → <slug>.md; other app paths become plain text in the docs. */
function href(to: string): string | null {
  const m = /^\/help\/([\w-]+)(#.*)?$/.exec(to);
  if (m) return `${m[1]}.md${m[2] ?? ""}`;
  if (/^https?:\/\//.test(to)) return to;
  return null;
}

/** Inline content → a single line of Markdown. */
function inline(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node).replace(/\s+/g, " ");
  if (Array.isArray(node)) return node.map(inline).join("");
  if (!React.isValidElement(node)) return "";
  const el = node as El;
  const kids = () => inline(el.props.children);
  if (el.type === React.Fragment) return kids();
  if (el.type === UI) return `**${kids().trim()}**`;
  if (el.type === Link || el.type === "a") {
    const to = href(String(el.props.href ?? ""));
    return to ? `[${kids().trim()}](${to})` : kids();
  }
  switch (el.type) {
    case "strong":
    case "b":
      return `**${kids().trim()}**`;
    case "em":
    case "i":
      return `*${kids().trim()}*`;
    case "code":
      return "`" + kids() + "`";
    case "br":
      return "  \n";
    default:
      // Anything else (a component used inline) contributes its text.
      if (typeof el.type === "function") return inline((el.type as (p: unknown) => React.ReactNode)(el.props));
      return kids();
  }
}

const clean = (s: string) => s.replace(/[ \t]+\n/g, "\n").replace(/ {2,}/g, " ").trim();

/** Block content → Markdown paragraphs. */
function block(node: React.ReactNode): string[] {
  if (node == null || typeof node === "boolean") return [];
  if (Array.isArray(node)) return node.flatMap(block);
  if (typeof node === "string" || typeof node === "number") {
    const t = clean(String(node));
    return t ? [t] : [];
  }
  if (!React.isValidElement(node)) return [];
  const el = node as El;
  const children = el.props.children;
  if (el.type === React.Fragment) return block(children);
  if (el.type === Lead) return [`> ${clean(inline(children))}`];
  if (el.type === H2) return [`## ${clean(inline(children))}`];
  if (el.type === H3) return [`### ${clean(inline(children))}`];
  if (el.type === P) return [clean(inline(children))];
  if (el.type === UL) {
    return [
      React.Children.toArray(children)
        .map((li) => `- ${clean(inline(React.isValidElement(li) ? (li as El).props.children : li))}`)
        .join("\n"),
    ];
  }
  if (el.type === Steps) {
    return [
      React.Children.toArray(children)
        .map((step, i) => `${i + 1}. ${clean(inline(step))}`)
        .join("\n"),
    ];
  }
  if (el.type === Callout) {
    const tone = (el.props.tone as keyof typeof CALLOUT_LABEL) ?? "note";
    const label = (el.props.title as string) ?? CALLOUT_LABEL[tone];
    return [`> **${label}.** ${clean(inline(children))}`];
  }
  if (el.type === DefList) {
    return React.Children.toArray(children).flatMap((d) => {
      if (!React.isValidElement(d) || (d as El).type !== Def) return block(d);
      const def = d as El;
      return [`**${clean(inline(def.props.term as React.ReactNode))}** — ${clean(inline(def.props.children))}`];
    });
  }
  if (el.type === Table) {
    const head = el.props.head as React.ReactNode[];
    const rows = el.props.rows as React.ReactNode[][];
    const cell = (c: React.ReactNode) => clean(inline(c)).replace(/\|/g, "\\|");
    return [
      [`| ${head.map(cell).join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`)].join("\n"),
    ];
  }
  if (el.type === LI) return [`- ${clean(inline(children))}`];
  if (typeof el.type === "function") return block((el.type as (p: unknown) => React.ReactNode)(el.props));
  return [clean(inline(node))];
}

const NOTE = "<!-- Generated from src/components/help by `npm run help:export`. Edit the app's help, not this file. -->";

function render(): Map<string, string> {
  const files = new Map<string, string>();
  HELP_TOPICS.forEach((t, i) => {
    const prev = HELP_TOPICS[i - 1];
    const next = HELP_TOPICS[i + 1];
    const nav = [prev && `← [${prev.title}](${prev.slug}.md)`, "[All guides](README.md)", next && `[${next.title}](${next.slug}.md) →`].filter(Boolean).join(" · ");
    const body = block(React.createElement(t.Body)).join("\n\n");
    files.set(`${t.slug}.md`, `${NOTE}\n\n# ${t.title}\n\n${body}\n\n---\n\n${nav}\n`);
  });
  const groups = [...new Set(HELP_TOPICS.map((t) => t.group))] as HelpGroup[];
  const index = groups
    .map((g) => `## ${g}\n\n${HELP_TOPICS.filter((t) => t.group === g).map((t) => `- [${t.title}](${t.slug}.md) — ${t.summary}`).join("\n")}`)
    .join("\n\n");
  files.set(
    "README.md",
    `${NOTE}\n\n# Tavoro Help\n\nThe guides built into Tavoro (the **Help** link in the app's sidebar), as Markdown. They describe the current \`main\` branch.\n\n${index}\n`,
  );
  return files;
}

const files = render();
if (process.argv.includes("--check")) {
  const stale = [...files].filter(([name, text]) => {
    try {
      return readFileSync(join(OUT, name), "utf8") !== text;
    } catch {
      return true;
    }
  });
  const extra = readdirSync(OUT).filter((f) => f.endsWith(".md") && !files.has(f));
  if (stale.length || extra.length) {
    console.error(`docs/help is out of date (${[...stale.map(([n]) => n), ...extra].join(", ")}). Run: npm run help:export`);
    process.exit(1);
  }
  console.log(`docs/help is up to date (${files.size} files).`);
} else {
  mkdirSync(OUT, { recursive: true });
  for (const f of readdirSync(OUT)) if (f.endsWith(".md") && !files.has(f)) unlinkSync(join(OUT, f));
  for (const [name, text] of files) writeFileSync(join(OUT, name), text);
  console.log(`Wrote ${files.size} files to docs/help.`);
}
