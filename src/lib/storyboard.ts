// Storyboarding (Phase 3) vocabulary. Screen types and statuses are stored as
// strings; these const arrays + label maps are the single source of truth for
// validation (Zod enums) and display.

export const STORYBOARD_STATUSES = ["draft", "in_review", "approved"] as const;
export type StoryboardStatus = (typeof STORYBOARD_STATUSES)[number];

export const STORYBOARD_STATUS_LABEL: Record<StoryboardStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
};

export const SCREEN_TYPES = [
  "intro",
  "content",
  "video",
  "knowledge_check",
  "interaction",
  "assessment",
  "summary",
] as const;
export type ScreenType = (typeof SCREEN_TYPES)[number];

export const SCREEN_TYPE_LABEL: Record<ScreenType, string> = {
  intro: "Intro",
  content: "Content",
  video: "Video",
  knowledge_check: "Knowledge check",
  interaction: "Interaction",
  assessment: "Assessment",
  summary: "Summary",
};

// The editable rich-text fields on a screen, in display order. Used by the editor
// to render one TipTap field per entry without repeating the list everywhere.
export const SCREEN_FIELDS = [
  { key: "onScreenText", label: "On-screen text" },
  { key: "narration", label: "Narration / VO" },
  { key: "visualNotes", label: "Visual & media notes" },
  { key: "interactionNotes", label: "Interaction & branching" },
  { key: "developerNotes", label: "Developer notes" },
] as const;
export type ScreenFieldKey = (typeof SCREEN_FIELDS)[number]["key"];
