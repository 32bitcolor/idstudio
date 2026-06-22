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

export const REVIEW_STATUSES = ["requested", "in_review", "changes_requested", "approved"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  requested: "Requested",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
};
