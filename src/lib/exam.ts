// Certifications & exams (Phase 4) vocabulary. Exam statuses and question types
// are stored as strings; these const arrays + label maps are the single source of
// truth for validation (Zod enums) and display, mirroring lib/storyboard.ts.

export const EXAM_STATUSES = ["draft", "published", "archived"] as const;
export type ExamStatus = (typeof EXAM_STATUSES)[number];

export const EXAM_STATUS_LABEL: Record<ExamStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const QUESTION_TYPES = [
  "multiple_choice",
  "multi_select",
  "true_false",
  "short_answer",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  multiple_choice: "Multiple choice",
  multi_select: "Multiple answer",
  true_false: "True / false",
  short_answer: "Short answer",
};

// Choice-based types carry a list of selectable options; short_answer is free text.
// Single-correct types accept exactly one correct option (selecting one clears the
// rest); multi_select may mark several. Scoring (Slice 2) reads the same flags.
export const OPTION_BASED_TYPES = ["multiple_choice", "multi_select", "true_false"] as const;
export const SINGLE_CORRECT_TYPES = ["multiple_choice", "true_false"] as const;

export function isOptionBased(type: string): boolean {
  return (OPTION_BASED_TYPES as readonly string[]).includes(type);
}

export function isSingleCorrect(type: string): boolean {
  return (SINGLE_CORRECT_TYPES as readonly string[]).includes(type);
}

// Bounds shared by validation and the settings UI.
export const PASSING_SCORE_MIN = 0;
export const PASSING_SCORE_MAX = 100;
