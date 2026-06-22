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
