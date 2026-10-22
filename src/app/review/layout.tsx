import type { Metadata } from "next";
import { TavoroLogo } from "@/components/shared/brand";

// Guest review pages: no app shell, no sidebar, nothing from the (app) group. Guests
// reach exactly one round through lib/review-guest.ts and never anything else.
export const metadata: Metadata = {
  title: "Review · Tavoro",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function GuestReviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-surface">
        <div className="flex h-12 items-center gap-2 px-6 text-sm">
          <TavoroLogo className="text-base" markClassName="size-6" />
          <span className="text-muted-foreground">· Review</span>
        </div>
      </header>
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
