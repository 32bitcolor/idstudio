import { TavoroLogo } from "@/components/shared/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="flex justify-center text-3xl">
            <TavoroLogo markClassName="size-10" />
          </h1>
          <p className="mt-1 text-sm text-foreground/60">The workbench for instructional design teams</p>
        </div>
        <div className="rounded-xl border border-border p-6">{children}</div>
      </div>
    </div>
  );
}
