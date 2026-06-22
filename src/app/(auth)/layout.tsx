export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">IDStudio</h1>
          <p className="mt-1 text-sm text-foreground/60">Instructional Designer Workspace</p>
        </div>
        <div className="rounded-xl border border-border p-6">{children}</div>
      </div>
    </div>
  );
}
