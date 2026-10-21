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

export const ReviewAnchor = z.discriminatedUnion("kind", [GeneralAnchor, StoryboardFieldAnchor]);
export type ReviewAnchor = z.infer<typeof ReviewAnchor>;

export const GENERAL_ANCHOR: ReviewAnchor = { kind: "general" };

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
