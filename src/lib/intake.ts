export const INTAKE_STATUSES = ["submitted", "triaging", "approved", "rejected", "converted"] as const;
export type IntakeStatus = (typeof INTAKE_STATUSES)[number];

export const INTAKE_STATUS_LABEL: Record<IntakeStatus, string> = {
  submitted: "Submitted",
  triaging: "Triaging",
  approved: "Approved",
  rejected: "Rejected",
  converted: "Converted",
};

export const SCORE_VALUES = [1, 2, 3, 4, 5] as const;
export type ScoreValue = (typeof SCORE_VALUES)[number];

// Weighting impact 2:1 over effort is a deliberate, simple call — rewards
// high-impact work without letting effort alone veto it. Range: -4..9.
export function priorityScore(impact: number, effort: number): number {
  return impact * 2 - effort;
}

// A classic impact/effort quadrant, derived from the same two scores — no extra
// state to store or keep in sync.
export function quadrantLabel(impact: number | null, effort: number | null): string | null {
  if (impact == null || effort == null) return null;
  if (impact >= 4 && effort <= 2) return "Quick win";
  if (impact >= 4 && effort >= 4) return "Big bet";
  if (impact <= 2 && effort <= 2) return "Fill-in";
  if (impact <= 2 && effort >= 4) return "Reconsider";
  return "Balanced";
}

export function ticketLabel(number: number): string {
  return `REQ-${number}`;
}
