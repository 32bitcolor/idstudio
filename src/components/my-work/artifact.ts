import type { Prisma } from "@/generated/prisma/client";

// Shared Prisma select + artifact resolver for review-linked deliverables, used by
// both My Work tabs (Overview and Review History).
export const DELIVERABLE_SELECT = {
  id: true,
  name: true,
  project: { select: { id: true, name: true } },
  storyboard: { select: { id: true, title: true } },
  card: { select: { title: true, column: { select: { board: { select: { id: true, name: true } } } } } },
} satisfies Prisma.DeliverableSelect;

type Deliverable = {
  project: { id: string; name: string };
  storyboard: { id: string; title: string } | null;
  card: { title: string; column: { board: { id: string; name: string } } } | null;
};

/** The most specific artifact a review points at (storyboard > card > project). */
export function artifactLink(d: Deliverable): { href: string; label: string } {
  if (d.storyboard) return { href: `/storyboards/${d.storyboard.id}`, label: `Storyboard · ${d.storyboard.title}` };
  if (d.card) return { href: `/boards/${d.card.column.board.id}`, label: `Card · ${d.card.title}` };
  return { href: `/projects/${d.project.id}`, label: `Project · ${d.project.name}` };
}
