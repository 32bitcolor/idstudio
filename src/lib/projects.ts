import "server-only";
import { prisma } from "@/lib/db";
import { positionsAfter } from "@/lib/ordering";
import { METHODOLOGY_PHASES } from "@/lib/methodology";
import type { Methodology } from "@/generated/prisma/client";

// Shared by createProject (form submit → redirect) and approveIntakeRequest
// (triage action → returns the id) so both get identical phase seeding.
export async function createProjectForWorkspace(
  workspaceId: string,
  name: string,
  methodology: Methodology = "ADDIE",
): Promise<{ id: string }> {
  const phaseNames = METHODOLOGY_PHASES[methodology];
  const positions = positionsAfter(null, phaseNames.length);
  return prisma.project.create({
    data: {
      workspaceId,
      name,
      methodology,
      phases: { create: phaseNames.map((n, i) => ({ name: n, position: positions[i] })) },
    },
    select: { id: true },
  });
}
