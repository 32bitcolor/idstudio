// Phase templates seeded when a project is created. CUSTOM starts empty so the
// designer builds their own pipeline.
export const METHODOLOGY_PHASES: Record<"ADDIE" | "SAM" | "CUSTOM", string[]> = {
  ADDIE: ["Analyze", "Design", "Develop", "Implement", "Evaluate"],
  SAM: ["Preparation", "Iterative Design", "Iterative Development"],
  CUSTOM: [],
};

export const PHASE_STATUSES = ["not_started", "in_progress", "done"] as const;
export type PhaseStatus = (typeof PHASE_STATUSES)[number];

export const PHASE_STATUS_LABEL: Record<PhaseStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

export const PROJECT_STATUSES = ["active", "on_hold", "completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
};

export const DELIVERABLE_TYPES = [
  "storyboard",
  "course",
  "assessment",
  "job_aid",
  "video",
  "document",
  "other",
] as const;
export type DeliverableType = (typeof DELIVERABLE_TYPES)[number];

export const DELIVERABLE_TYPE_LABEL: Record<DeliverableType, string> = {
  storyboard: "Storyboard",
  course: "Course",
  assessment: "Assessment",
  job_aid: "Job aid",
  video: "Video",
  document: "Document",
  other: "Other",
};

export const DELIVERABLE_STATUSES = ["not_started", "in_progress", "in_review", "complete"] as const;
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];

export const DELIVERABLE_STATUS_LABEL: Record<DeliverableStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  in_review: "In review",
  complete: "Complete",
};

// Bloom's Revised Taxonomy — cognitive levels, low → high. Tagging an objective
// with its level nudges toward measurable, appropriately-pitched verbs.
export const BLOOM_LEVELS = [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
] as const;
export type BloomLevel = (typeof BLOOM_LEVELS)[number];

export const BLOOM_LABEL: Record<BloomLevel, string> = {
  remember: "Remember",
  understand: "Understand",
  apply: "Apply",
  analyze: "Analyze",
  evaluate: "Evaluate",
  create: "Create",
};

// A few strong, observable verbs per level — surfaced as a hint when writing an
// objective (helps replace fuzzy verbs like "understand" / "know").
export const BLOOM_VERBS: Record<BloomLevel, string[]> = {
  remember: ["define", "list", "recall", "identify", "name", "state"],
  understand: ["explain", "summarize", "classify", "describe", "compare", "interpret"],
  apply: ["apply", "demonstrate", "use", "solve", "execute", "carry out"],
  analyze: ["differentiate", "organize", "analyze", "diagnose", "attribute", "compare"],
  evaluate: ["evaluate", "critique", "justify", "assess", "recommend", "prioritize"],
  create: ["design", "construct", "produce", "develop", "compose", "plan"],
};

export const ASSESSMENT_ITEM_TYPES = [
  "multiple_choice",
  "true_false",
  "short_answer",
  "scenario",
  "other",
] as const;
export type AssessmentItemType = (typeof ASSESSMENT_ITEM_TYPES)[number];

export const ASSESSMENT_ITEM_TYPE_LABEL: Record<AssessmentItemType, string> = {
  multiple_choice: "Multiple choice",
  true_false: "True / false",
  short_answer: "Short answer",
  scenario: "Scenario",
  other: "Other",
};

export const REVIEW_STATUSES = ["requested", "in_review", "changes_requested", "approved"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  requested: "Requested",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
};
