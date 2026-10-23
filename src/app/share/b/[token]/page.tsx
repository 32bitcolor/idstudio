import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicBoard } from "@/lib/board-share";
import { checkThrottle, clientIp } from "@/lib/throttle";
import { PublicBoardView } from "@/components/share/public-board-view";

export const dynamic = "force-dynamic";

const load = cache(loadPublicBoard);

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const board = await load((await params).token);
  return { title: board ? `${board.name} · Tavoro` : "Not found · Tavoro" };
}

export default async function PublicBoardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // A wrong, reset or switched-off link is the same plain 404, so a link can't be
  // used to learn whether a board exists.
  if (!(await checkThrottle(`share:${await clientIp()}`, 120, 60))) notFound();
  const board = await load(token);
  if (!board) notFound();
  return <PublicBoardView board={board} />;
}
