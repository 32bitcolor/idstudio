import { cache } from "react";
import { notFound } from "next/navigation";
import { getStoryboardForUser } from "@/lib/authz";
import { storyboardExport } from "@/lib/review-export";
import { ExportDocument } from "@/components/review/export-document";
import { PrintToolbar } from "@/components/review/print-toolbar";

// The page title is the PDF's file name when it's saved, so it's the document's name.
const load = cache(storyboardExport);

export async function generateMetadata({ params }: { params: Promise<{ storyboardId: string }> }) {
  const { storyboardId } = await params;
  const doc = (await getStoryboardForUser(storyboardId)) ? await load(storyboardId) : null;
  return { title: doc?.fileName ?? "Export · Tavoro" };
}

export default async function PrintStoryboardPage({ params }: { params: Promise<{ storyboardId: string }> }) {
  const { storyboardId } = await params;
  if (!(await getStoryboardForUser(storyboardId))) notFound();
  const doc = await load(storyboardId);
  if (!doc) notFound();
  return (
    <>
      <PrintToolbar
        wordHref={`/api/storyboards/${storyboardId}/export`}
        backHref={`/storyboards/${storyboardId}`}
        backLabel="Back to the storyboard"
      />
      <ExportDocument doc={doc} />
    </>
  );
}
