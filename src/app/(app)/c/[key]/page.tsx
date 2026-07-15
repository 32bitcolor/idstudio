import { notFound, redirect } from "next/navigation";
import { resolveCardKey } from "@/lib/authz";

/** Short, shareable card link: /c/WP-5 -> the board with ?card=<id> open,
 * so pasting "https://.../c/WP-5" in Slack/email opens straight to the card
 * drawer instead of needing the raw internal id. */
export default async function CardKeyPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const match = /^([A-Za-z][A-Za-z0-9]{1,7})-(\d+)$/.exec(key.trim());
  if (!match) notFound();

  const [, prefix, seqStr] = match;
  const resolved = await resolveCardKey(prefix, Number(seqStr));
  if (!resolved) notFound();

  redirect(`/boards/${resolved.boardId}?card=${resolved.cardId}`);
}
