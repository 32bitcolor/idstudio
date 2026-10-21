"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Above the print view, never on the page itself. */
export function PrintToolbar({ wordHref, backHref, backLabel }: { wordHref: string; backHref: string; backLabel: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[52rem] flex-wrap items-center gap-2 py-4 print:hidden">
      <a href={backHref} className="mr-auto text-sm text-muted-foreground hover:text-foreground hover:underline">
        ← {backLabel}
      </a>
      <Button asChild variant="outline" size="sm">
        <a href={wordHref} download>
          <Download className="size-4" aria-hidden="true" /> Word (.docx)
        </a>
      </Button>
      <Button size="sm" onClick={() => window.print()}>
        <Printer className="size-4" aria-hidden="true" /> Print or save as PDF
      </Button>
    </div>
  );
}
