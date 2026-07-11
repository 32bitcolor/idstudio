import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { HELP_TOPICS, getTopic, topicIndex } from "@/components/help/registry";
import { HelpCrumb } from "@/components/help/help-crumb";

export function generateStaticParams() {
  return HELP_TOPICS.map((t) => ({ slug: t.slug }));
}

export default async function HelpArticle({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = getTopic(slug);
  if (!topic) notFound();

  const i = topicIndex(slug);
  const prev = i > 0 ? HELP_TOPICS[i - 1] : null;
  const next = i < HELP_TOPICS.length - 1 ? HELP_TOPICS[i + 1] : null;
  const { Body } = topic;

  return (
    <article>
      <HelpCrumb title={topic.title} />
      <Link
        href="/help"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All guides
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-accent/12 text-accent">
          <topic.icon className="size-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{topic.title}</h1>
      </div>

      <Body />

      <nav className="mt-14 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between">
        {prev ? (
          <Link
            href={`/help/${prev.slug}`}
            className="group flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:border-border-strong hover:bg-hover sm:max-w-[48%]"
          >
            <ArrowLeft className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">Previous</span>
              <span className="block truncate font-medium">{prev.title}</span>
            </span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/help/${next.slug}`}
            className="group flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-right text-sm transition-colors hover:border-border-strong hover:bg-hover sm:ml-auto sm:max-w-[48%]"
          >
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">Next</span>
              <span className="block truncate font-medium">{next.title}</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}
