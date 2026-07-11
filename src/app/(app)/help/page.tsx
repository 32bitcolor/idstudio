import Link from "next/link";
import { ArrowRight, LifeBuoy } from "lucide-react";

import { HELP_GROUPS, HELP_TOPICS } from "@/components/help/registry";

export default function HelpIndex() {
  return (
    <div>
      <div className="mb-10">
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-accent/12 text-accent">
          <LifeBuoy className="size-6" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Help &amp; guides</h1>
        <p className="mt-2 max-w-xl text-lg text-muted-foreground">
          Everything you need to run your instructional-design process in IDStudio — start here, then
          dive into the module that fits what you&rsquo;re working on.
        </p>
      </div>

      <div className="flex flex-col gap-8">
        {HELP_GROUPS.map((group) => (
          <section key={group}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {HELP_TOPICS.filter((t) => t.group === group).map((t) => (
                <Link
                  key={t.slug}
                  href={`/help/${t.slug}`}
                  className="group flex items-start gap-3.5 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-hover"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent">
                    <t.icon className="size-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-medium tracking-tight">{t.title}</h3>
                      <ArrowRight className="size-3.5 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                    </div>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{t.summary}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
