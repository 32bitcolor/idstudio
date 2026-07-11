// Block model for the course authoring feature. A Block stores its `type` plus a
// JSON `content` blob whose shape depends on the type. Keeping content typed +
// self-describing here (not in the DB) is what lets us render a learner view and
// package it to SCORM / xAPI.

export const BLOCK_TYPES = [
  "heading",
  "text",
  "statement",
  "quote",
  "list",
  "image",
  "multimedia",
  "divider",
  "accordion",
  "tabs",
  "process",
  "flashcards",
  "knowledge_check",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_LABEL: Record<BlockType, string> = {
  heading: "Heading",
  text: "Text",
  statement: "Statement",
  quote: "Quote",
  list: "List",
  image: "Image",
  multimedia: "Video embed",
  divider: "Divider",
  accordion: "Accordion",
  tabs: "Tabs",
  process: "Process",
  flashcards: "Flashcards",
  knowledge_check: "Knowledge check",
};

export const BLOCK_DESCRIPTION: Record<BlockType, string> = {
  heading: "A section title",
  text: "A rich paragraph, with lists and formatting",
  statement: "A short, emphasized callout",
  quote: "A pull-quote with an attribution",
  list: "A bulleted, numbered, or checked list",
  image: "An uploaded or linked image with a caption",
  multimedia: "An embedded YouTube or Vimeo video",
  divider: "A horizontal divider",
  accordion: "Collapsible sections the learner expands one at a time",
  tabs: "Parallel sections the learner switches between",
  process: "Numbered, sequential steps",
  flashcards: "Flip cards — a prompt on the front, an answer on the back",
  knowledge_check: "A question — multiple choice, multi-select, or fill in the blank",
};

/** Groups the inserter menu the way Rise separates content from interactions. */
export const BLOCK_CATEGORY: Record<BlockType, "content" | "interactive"> = {
  heading: "content",
  text: "content",
  statement: "content",
  quote: "content",
  list: "content",
  image: "content",
  multimedia: "content",
  divider: "content",
  accordion: "interactive",
  tabs: "interactive",
  process: "interactive",
  flashcards: "interactive",
  knowledge_check: "interactive",
};

// ── Per-type content shapes ───────────────────────────────────────────────────

export type HeadingContent = { text: string; level: 1 | 2 | 3 };
export type TextContent = { doc: string | null }; // TipTap JSON string
export type StatementContent = { text: string };
export type QuoteContent = { quote: string; attribution: string };
export type ListStyle = "bullet" | "number" | "check";
export type ListContent = { style: ListStyle; items: string[] };
// `key` is the S3 object key for an uploaded image (bundled into exports);
// null means `url` holds a plain external link instead (referenced as-is).
export type ImageContent = { key: string | null; url: string; alt: string; caption: string };
export type MultimediaContent = { url: string; caption: string };
export type DividerContent = Record<string, never>;
export type AccordionItem = { id: string; title: string; body: string };
export type AccordionContent = { items: AccordionItem[] };
export type TabItem = { id: string; title: string; body: string };
export type TabsContent = { items: TabItem[] };
export type ProcessStep = { id: string; title: string; body: string };
export type ProcessContent = { steps: ProcessStep[] };
export type Flashcard = { id: string; front: string; back: string };
export type FlashcardsContent = { cards: Flashcard[] };

export const KNOWLEDGE_CHECK_TYPES = ["single", "multi", "fill_blank"] as const;
export type KnowledgeCheckType = (typeof KNOWLEDGE_CHECK_TYPES)[number];
export const KNOWLEDGE_CHECK_TYPE_LABEL: Record<KnowledgeCheckType, string> = {
  single: "Multiple choice (one answer)",
  multi: "Multi-select (multiple answers)",
  fill_blank: "Fill in the blank",
};
export type KnowledgeCheckOption = { id: string; text: string; correct: boolean };
export type KnowledgeCheckContent = {
  questionType: KnowledgeCheckType;
  question: string;
  options: KnowledgeCheckOption[]; // single / multi
  acceptedAnswers: string[]; // fill_blank — any (case-insensitive, trimmed) match is correct
  feedback: string;
  objectiveIds: string[];
};

export type BlockContentMap = {
  heading: HeadingContent;
  text: TextContent;
  statement: StatementContent;
  quote: QuoteContent;
  list: ListContent;
  image: ImageContent;
  multimedia: MultimediaContent;
  divider: DividerContent;
  accordion: AccordionContent;
  tabs: TabsContent;
  process: ProcessContent;
  flashcards: FlashcardsContent;
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
    case "quote":
      return { quote: "", attribution: "" } satisfies QuoteContent;
    case "list":
      return { style: "bullet", items: [] } satisfies ListContent;
    case "image":
      return { key: null, url: "", alt: "", caption: "" } satisfies ImageContent;
    case "multimedia":
      return { url: "", caption: "" } satisfies MultimediaContent;
    case "divider":
      return {} satisfies DividerContent;
    case "accordion":
      return { items: [] } satisfies AccordionContent;
    case "tabs":
      return { items: [] } satisfies TabsContent;
    case "process":
      return { steps: [] } satisfies ProcessContent;
    case "flashcards":
      return { cards: [] } satisfies FlashcardsContent;
    case "knowledge_check":
      return {
        questionType: "single",
        question: "",
        options: [],
        acceptedAnswers: [],
        feedback: "",
        objectiveIds: [],
      } satisfies KnowledgeCheckContent;
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

/** Detect a YouTube / Vimeo URL and return an embeddable iframe src, or null. */
export function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}
