import Link from "next/link";
import { requireUser, getActiveMembership } from "@/lib/dal";
import { Role } from "@/generated/prisma/client";

export const metadata = { title: "Dashboard · IDStudio" };

// Feature areas. `href` marks a module that's live; the rest are upcoming phases.
const MODULES: { name: string; desc: string; phase: string; href?: string }[] = [
  { name: "Kanban Board", desc: "Boards, cards, drag & drop", phase: "Phase 1", href: "/boards" },
  { name: "Project Management", desc: "ADDIE/SAM workflows, deliverables", phase: "Phase 2", href: "/projects" },
  { name: "Storyboarding", desc: "Frame-by-frame course storyboards", phase: "Phase 3", href: "/storyboards" },
  { name: "Certifications & Exams", desc: "Exam builder, question banks", phase: "Phase 4", href: "/exams" },
  { name: "LMS Integration", desc: "Sync to LearnUpon", phase: "Phase 5" },
];

export default async function DashboardPage() {
  const user = await requireUser();
  const membership = await getActiveMembership();
  const isAdmin = membership?.role === Role.ADMIN;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-foreground/60">{membership?.workspace.name ?? "No workspace"}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Welcome, {user.name ?? user.email}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="rounded-full border border-border px-2 py-0.5 text-foreground/70">
              {user.email}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 font-medium ${
                isAdmin
                  ? "bg-accent text-accent-foreground"
                  : "border border-border text-foreground/70"
              }`}
            >
              {membership?.role ?? "—"}
            </span>
          </div>
        </div>
      </header>

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">Modules</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => {
            const className = `block rounded-xl border p-4 ${
              m.href
                ? "border-border hover:border-foreground/40"
                : "border-border"
            }`;
            const inner = (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{m.name}</h3>
                  <span className="text-xs text-foreground/50">{m.phase}</span>
                </div>
                <p className="mt-1 text-sm text-foreground/60">{m.desc}</p>
                <p className={`mt-3 text-xs ${m.href ? "text-foreground/70" : "text-foreground/40"}`}>
                  {m.href ? "Open →" : "Coming soon"}
                </p>
              </>
            );
            return m.href ? (
              <Link key={m.name} href={m.href} className={className}>
                {inner}
              </Link>
            ) : (
              <div key={m.name} className={className}>
                {inner}
              </div>
            );
          })}
        </div>
      </section>

      {isAdmin && (
        <section className="mt-10 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="text-sm font-medium">Admin tools</h2>
          <p className="mt-1 text-sm text-foreground/60">
            Only workspace admins can see this. Member management and workspace settings will live here.
          </p>
        </section>
      )}
    </div>
  );
}
