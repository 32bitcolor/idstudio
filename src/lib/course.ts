// Block model for the course authoring feature. A Block stores its `type` plus a
// JSON `content` blob whose shape depends on the type. Keeping content typed +
// self-describing here (not in the DB) is what will let us render a learner view
// and, later, package it to SCORM / xAPI.

export const BLOCK_TYPES = [
  "heading",
  "text",
  "statement",
  "image",
  "divider",
  "accordion",
  "knowledge_check",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_LABEL: Record<BlockType, string> = {
  heading: "Heading",
  text: "Text",
  statement: "Statement",
  image: "Image",
  divider: "Divider",
  accordion: "Accordion",
  knowledge_check: "Knowledge check",
};

export const BLOCK_DESCRIPTION: Record<BlockType, string> = {
  heading: "A section title",
  text: "A rich paragraph, with lists and formatting",
  statement: "A short, emphasized callout",
  image: "An image with optional caption",
  divider: "A horizontal divider",
  accordion: "Collapsible sections the learner expands",
  knowledge_check: "A multiple-choice question with feedback",
};

// ── Per-type content shapes ───────────────────────────────────────────────────

export type HeadingContent = { text: string; level: 1 | 2 | 3 };
export type TextContent = { doc: string | null }; // TipTap JSON string
export type StatementContent = { text: string };
export type ImageContent = { url: string; alt: string; caption: string };
export type DividerContent = Record<string, never>;
export type AccordionItem = { id: string; title: string; body: string };
export type AccordionContent = { items: AccordionItem[] };
export type KnowledgeCheckOption = { id: string; text: string; correct: boolean };
export type KnowledgeCheckContent = {
  question: string;
  options: KnowledgeCheckOption[];
  feedback: string;
  objectiveIds: string[];
};

export type BlockContentMap = {
  heading: HeadingContent;
  text: TextContent;
  statement: StatementContent;
  image: ImageContent;
  divider: DividerContent;
  accordion: AccordionContent;
  knowledge_check: KnowledgeCheckContent;
};

export function defaultBlockContent(type: BlockType): BlockContentMap[BlockType] {
  switch (type) {
    case "heading":
      return { text: "", level: 2 } satisfies HeadingContent;
    case "text":
      return { doc: null } satisfies TextContent;
    case "statement":
      return { text: "" } satisfies StatementContent;
    case "image":
      return { url: "", alt: "", caption: "" } satisfies ImageContent;
    case "divider":
      return {} satisfies DividerContent;
    case "accordion":
      return { items: [] } satisfies AccordionContent;
    case "knowledge_check":
      return { question: "", options: [], feedback: "", objectiveIds: [] } satisfies KnowledgeCheckContent;
  }
}

/** Parse a block's stored JSON, falling back to the type's default on any error. */
export function parseBlockContent<T extends BlockType>(type: T, json: string): BlockContentMap[T] {
  const fallback = defaultBlockContent(type) as BlockContentMap[T];
  try {
    const parsed = JSON.parse(json || "{}");
    return { ...(fallback as object), ...(parsed as object) } as BlockContentMap[T];
  } catch {
    return fallback;
  }
}
