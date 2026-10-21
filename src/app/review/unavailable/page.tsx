import { LinkIcon } from "lucide-react";

const COPY: Record<string, { title: string; body: string }> = {
  expired: {
    title: "This review link has expired",
    body: "Ask the person who sent it for a new link.",
  },
  revoked: {
    title: "This review link was turned off",
    body: "The team that sent it has withdrawn it. If you still need access, ask them for a new link.",
  },
  invalid: {
    title: "This review link doesn't work",
    body: "It may have been copied incompletely, or replaced by a newer link. Check your most recent email, or ask the sender for a new one.",
  },
};

export default async function ReviewUnavailablePage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const copy = COPY[reason ?? ""] ?? COPY.invalid;
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-4 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <LinkIcon className="size-5" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>
      </div>
    </div>
  );
}
