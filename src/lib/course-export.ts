import "server-only";
import { zipSync, strToU8 } from "fflate";
import {
  parseBlockContent,
  embedUrl,
  orderLessonsBySections,
  type BlockType,
  type ImageContent,
  type LabeledGraphicContent,
  type SortContent,
  type KnowledgeCheckContent,
} from "@/lib/course";
import { getObjectBytes } from "@/lib/storage";
import { STYLES, PLAYER_JS, SCORM_JS, xapiJs, indexHtml } from "@/lib/course-export-assets";

export type ExportFormat = "scorm12" | "scorm2004" | "xapi";

export const EXPORT_LABELS: Record<ExportFormat, string> = {
  scorm12: "SCORM 1.2",
  scorm2004: "SCORM 2004",
  xapi: "xAPI (Tin Can)",
};

type LoadedBlock = { id: string; blockType: string; content: string };
type LoadedLesson = { id: string; title: string; sectionId: string | null; position: string; blocks: LoadedBlock[] };
type LoadedSection = { id: string; title: string; position: string };
export type LoadedCourse = {
  id: string;
  title: string;
  description: string | null;
  sections: LoadedSection[];
  lessons: LoadedLesson[];
};

// ── TipTap (StarterKit) JSON → HTML ───────────────────────────────────────────

type TNode = { type?: string; text?: string; content?: TNode[]; marks?: { type: string }[]; attrs?: Record<string, unknown> };

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function withMarks(text: string, marks?: { type: string }[]): string {
  let out = text;
  for (const m of marks ?? []) {
    if (m.type === "bold") out = `<strong>${out}</strong>`;
    else if (m.type === "italic") out = `<em>${out}</em>`;
    else if (m.type === "code") out = `<code>${out}</code>`;
    else if (m.type === "strike") out = `<s>${out}</s>`;
  }
  return out;
}

function nodeToHtml(node: TNode): string {
  if (node.type === "text") return withMarks(escapeHtml(node.text ?? ""), node.marks);
  const inner = (node.content ?? []).map(nodeToHtml).join("");
  switch (node.type) {
    case "doc":
      return inner;
    case "paragraph":
      return `<p>${inner}</p>`;
    case "heading": {
      const lvl = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 2)));
      return `<h${lvl}>${inner}</h${lvl}>`;
    }
    case "bulletList":
      return `<ul>${inner}</ul>`;
    case "orderedList":
      return `<ol>${inner}</ol>`;
    case "listItem":
      return `<li>${inner}</li>`;
    case "blockquote":
      return `<blockquote>${inner}</blockquote>`;
    case "codeBlock":
      return `<pre><code>${inner}</code></pre>`;
    case "hardBreak":
      return "<br>";
    case "horizontalRule":
      return "<hr>";
    default:
      return inner;
  }
}

function tiptapToHtml(json: string | null): string {
  if (!json) return "";
  try {
    return nodeToHtml(JSON.parse(json) as TNode);
  } catch {
    return "";
  }
}

// ── Course → player data model ────────────────────────────────────────────────
// Async because an uploaded image's bytes are fetched from object storage and
// bundled into the package (media/{blockId}.{ext}) — the export must be fully
// self-contained, not hotlink back to this server's MinIO.

/** Resolve an uploaded image's key to a bundled `media/{blockId}.{ext}` file, or pass through a plain URL. */
async function resolveImageSrc(key: string | null, url: string, blockId: string, media: Record<string, Uint8Array>): Promise<string> {
  if (key) {
    const bytes = await getObjectBytes(key);
    if (bytes) {
      const ext = (key.match(/\.([a-zA-Z0-9]+)$/)?.[1] || "img").toLowerCase();
      const file = `media/${blockId}.${ext}`;
      media[file] = bytes;
      return file;
    }
    return ""; // object missing — best-effort
  }
  return url;
}

async function blockToModel(b: LoadedBlock, media: Record<string, Uint8Array>): Promise<Record<string, unknown> | null> {
  const type = b.blockType as BlockType;
  const c = parseBlockContent(type, b.content);
  switch (type) {
    case "heading": {
      const h = c as { text: string; level: number };
      return { type, level: h.level, text: h.text };
    }
    case "text":
      return { type, html: tiptapToHtml((c as { doc: string | null }).doc) };
    case "statement":
      return { type, text: (c as { text: string }).text };
    case "quote": {
      const q = c as { quote: string; attribution: string };
      return { type, quote: q.quote, attribution: q.attribution };
    }
    case "list": {
      const l = c as { style: string; items: string[] };
      return { type, style: l.style, items: l.items };
    }
    case "image": {
      const i = c as ImageContent;
      const src = await resolveImageSrc(i.key, i.url, b.id, media);
      return { type, url: src, alt: i.alt, caption: i.caption };
    }
    case "labeled_graphic": {
      const lg = c as LabeledGraphicContent;
      const src = await resolveImageSrc(lg.key, lg.url, b.id, media);
      return { type, url: src, alt: lg.alt, markers: lg.markers.map((m) => ({ id: m.id, x: m.x, y: m.y, title: m.title, body: m.body })) };
    }
    case "sort": {
      const s = c as SortContent;
      return {
        type,
        id: b.id,
        categories: s.categories.map((cat) => ({ id: cat.id, name: cat.name })),
        items: s.items.map((it) => ({ id: it.id, text: it.text, categoryId: it.categoryId })),
        feedback: s.feedback,
      };
    }
    case "multimedia": {
      const m = c as { url: string; caption: string };
      return { type, embed: embedUrl(m.url), url: m.url, caption: m.caption };
    }
    case "divider":
      return { type };
    case "accordion":
      return { type, items: (c as { items: { title: string; body: string }[] }).items.map((it) => ({ title: it.title, body: it.body })) };
    case "tabs":
      return { type, items: (c as { items: { title: string; body: string }[] }).items.map((it) => ({ title: it.title, body: it.body })) };
    case "process":
      return { type, steps: (c as { steps: { title: string; body: string }[] }).steps.map((s) => ({ title: s.title, body: s.body })) };
    case "flashcards":
      return { type, cards: (c as { cards: { front: string; back: string }[] }).cards.map((cd) => ({ front: cd.front, back: cd.back })) };
    case "knowledge_check": {
      const k = c as KnowledgeCheckContent;
      return {
        type,
        id: b.id,
        questionType: k.questionType,
        question: k.question,
        feedback: k.feedback,
        options: k.options.map((o) => ({ id: o.id, text: o.text, correct: o.correct })),
        acceptedAnswers: k.acceptedAnswers,
      };
    }
  }
  return null;
}

function activityId(course: LoadedCourse): string {
  return `http://idstudio.local/course/${course.id}`;
}

async function courseDataJs(course: LoadedCourse, media: Record<string, Uint8Array>): Promise<string> {
  const ordered = orderLessonsBySections(course.lessons, course.sections);
  const sectionTitle = new Map(course.sections.map((s) => [s.id, s.title]));
  const model = {
    title: course.title,
    lessons: await Promise.all(
      ordered.map(async (l) => ({
        title: l.title,
        section: l.sectionId ? (sectionTitle.get(l.sectionId) ?? null) : null,
        blocks: (await Promise.all(l.blocks.map((b) => blockToModel(b, media)))).filter(Boolean),
      })),
    ),
  };
  return `window.COURSE=${JSON.stringify(model)};`;
}

// ── Manifests ─────────────────────────────────────────────────────────────────

function escXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c] as string));
}

function scormManifest(course: LoadedCourse, runtimeFile: string, edition: "1.2" | "2004"): string {
  const title = escXml(course.title || "Course");
  const files = ["index.html", "player.js", runtimeFile, "course-data.js", "styles.css"]
    .map((f) => `      <file href="${f}"/>`)
    .join("\n");
  if (edition === "1.2") {
    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="IDSTUDIO_${course.id}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG">
    <organization identifier="ORG">
      <title>${title}</title>
      <item identifier="ITEM1" identifierref="RES1" isvisible="true"><title>${title}</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES1" type="webcontent" adlcp:scormtype="sco" href="index.html">
${files}
    </resource>
  </resources>
</manifest>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="IDSTUDIO_${course.id}" version="1.0"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <metadata><schema>ADL SCORM</schema><schemaversion>2004 4th Edition</schemaversion></metadata>
  <organizations default="ORG">
    <organization identifier="ORG">
      <title>${title}</title>
      <item identifier="ITEM1" identifierref="RES1"><title>${title}</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES1" type="webcontent" adlcp:scormType="sco" href="index.html">
${files}
    </resource>
  </resources>
</manifest>`;
}

function tincanXml(course: LoadedCourse): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<tincan xmlns="http://projecttincan.com/tincan.xsd">
  <activities>
    <activity id="${escXml(activityId(course))}" type="http://adlnet.gov/expapi/activities/course">
      <name>${escXml(course.title || "Course")}</name>
      <description lang="en-US">${escXml(course.description ?? course.title ?? "")}</description>
      <launch lang="en-US">index.html</launch>
    </activity>
  </activities>
</tincan>`;
}

// ── Assemble the package ──────────────────────────────────────────────────────

export async function buildCoursePackage(course: LoadedCourse, format: ExportFormat): Promise<{ zip: Uint8Array; filename: string }> {
  const media: Record<string, Uint8Array> = {};
  const files: Record<string, Uint8Array> = {
    "styles.css": strToU8(STYLES),
    "player.js": strToU8(PLAYER_JS),
    "course-data.js": strToU8(await courseDataJs(course, media)),
    ...media,
  };

  let runtimeFile: string;
  if (format === "xapi") {
    runtimeFile = "xapi.js";
    files["xapi.js"] = strToU8(xapiJs(activityId(course)));
    files["tincan.xml"] = strToU8(tincanXml(course));
  } else {
    runtimeFile = "scorm.js";
    files["scorm.js"] = strToU8(SCORM_JS);
    files["imsmanifest.xml"] = strToU8(scormManifest(course, runtimeFile, format === "scorm2004" ? "2004" : "1.2"));
  }
  files["index.html"] = strToU8(indexHtml(course.title || "Course", runtimeFile));

  const zip = zipSync(files, { level: 6 });
  const slug = (course.title || "course").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "course";
  return { zip, filename: `${slug}-${format}.zip` };
}
