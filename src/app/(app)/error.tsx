"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

import { PageContainer } from "@/components/shared/page";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageContainer>
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-16 text-center">
        <div
          className="mb-3 flex size-11 items-center justify-center rounded-full"
          style={{
            backgroundColor: "color-mix(in srgb, var(--color-destructive) 12%, transparent)",
            color: "var(--color-destructive)",
          }}
        >
          <TriangleAlert className="size-5" />
        </div>
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          An unexpected error occurred while loading this page. You can try again.
        </p>
        <Button className="mt-4" onClick={reset}>
          Try again
        </Button>
      </div>
    </PageContainer>
  );
}
