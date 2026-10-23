import type { Metadata } from "next";
import { TavoroLogo } from "@/components/shared/brand";

// Public, read-only boards (lib/board-share.ts): no app shell and nothing from the
// (app) group. Kept out of search engines, and the page URL out of Referer headers.
export const metadata: Metadata = {
  title: "Board · Tavoro",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-surface">
        <div className="flex h-12 items-center gap-2 px-4 text-sm sm:px-6">
          <TavoroLogo className="text-base" markClassName="size-6" />
          <span className="text-muted-foreground">· Read-only board</span>
        </div>
      </header>
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
