import { cache } from "react";
import { notFound } from "next/navigation";
import { getReviewRoundForUser } from "@/lib/authz";
import { roundExport } from "@/lib/review-export";
import { ExportDocument } from "@/components/review/export-document";
import { PrintToolbar } from "@/components/review/print-toolbar";

// The page title is the PDF's file name when it's saved, so it's the document's name.
const load = cache(roundExport);

export async function generateMetadata({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  const doc = (await getReviewRoundForUser(roundId)) ? await load(roundId) : null;
  return { title: doc?.fileName ?? "Export · Tavoro" };
}

export default async function PrintRoundPage({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  if (!(await getReviewRoundForUser(roundId))) notFound();
  const doc = await load(roundId);
  if (!doc) notFound();
  return (
    <>
      <PrintToolbar wordHref={`/api/review-rounds/${roundId}/export`} backHref={`/reviews/${roundId}`} backLabel="Back to the review" />
      <ExportDocument doc={doc} />
    </>
  );
}
