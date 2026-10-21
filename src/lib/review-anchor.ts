import { z } from "zod";

// What a review comment is about. Stored as JSON on ReviewComment.anchor; this is the
// single place that knows the shapes. Parsing is lenient (the saved-views pattern):
// an anchor this version doesn't understand degrades to "general" instead of erroring,
// so comments written by a later phase (file pins, video timestamps) still render.

export const SCREEN_FIELDS = ["onScreenText", "narration", "visualNotes", "interactionNotes", "developerNotes"] as const;
export type ScreenField = (typeof SCREEN_FIELDS)[number];

export const SCREEN_FIELD_LABEL: Record<ScreenField, string> = {
  onScreenText: "On-screen text",
  narration: "Narration",
  visualNotes: "Visuals",
  interactionNotes: "Interaction",
  developerNotes: "Developer notes",
};

const Quote = z.object({
  exact: z.string().min(1).max(500),
  prefix: z.string().max(80).optional(),
  suffix: z.string().max(80).optional(),
});

const GeneralAnchor = z.object({ kind: z.literal("general") });
const StoryboardFieldAnchor = z.object({
  kind: z.literal("storyboard_field"),
  screenId: z.string().min(1).max(64),
  field: z.enum(SCREEN_FIELDS),
  quote: Quote.optional(),
});

// Files (phase 3): a point or a rectangle on a PDF page, or on an image (page 1).
// Coordinates are 0–1 fractions of the page, so they hold at any zoom or screen size.
const Frac = z.number().min(0).max(1);
const Page = z.number().int().min(1).max(10000);
const FilePointAnchor = z.object({ kind: z.literal("file_point"), page: Page, x: Frac, y: Frac });
const FileRegionAnchor = z
  .object({ kind: z.literal("file_region"), page: Page, x: Frac, y: Frac, w: Frac, h: Frac })
  .refine((a) => a.x + a.w <= 1.0001 && a.y + a.h <= 1.0001 && a.w > 0 && a.h > 0, "Region is off the page.");

export const ReviewAnchor = z.union([GeneralAnchor, StoryboardFieldAnchor, FilePointAnchor, FileRegionAnchor]);
export type ReviewAnchor = z.infer<typeof ReviewAnchor>;

export const GENERAL_ANCHOR: ReviewAnchor = { kind: "general" };

export type FileAnchor = Extract<ReviewAnchor, { kind: "file_point" | "file_region" }>;

export function isFileAnchor(a: ReviewAnchor): a is FileAnchor {
  return a.kind === "file_point" || a.kind === "file_region";
}

/** Read a stored anchor; anything unusable becomes a general comment. */
export function parseAnchor(raw: unknown): ReviewAnchor {
  const parsed = ReviewAnchor.safeParse(raw);
  return parsed.success ? parsed.data : GENERAL_ANCHOR;
}

/** Strict validation for anchors arriving from the client. */
export function validateAnchor(raw: unknown): ReviewAnchor | null {
  const parsed = ReviewAnchor.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
