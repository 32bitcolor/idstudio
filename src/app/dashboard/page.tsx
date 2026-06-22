import { requireUser, getActiveMembership } from "@/lib/dal";
import { logout } from "@/app/actions/auth";
import { Role } from "@/generated/prisma/client";

export const metadata = { title: "Dashboard · IDStudio" };

// Future feature areas — placeholders so the skeleton shows the intended shape.
const MODULES = [
  { name: "Kanban Board", desc: "Boards, cards, drag & drop", phase: "Phase 1" },
  { name: "Project Management", desc: "ADDIE/SAM workflows, deliverables", phase: "Phase 2" },
  { name: "Storyboarding", desc: "Frame-by-frame course storyboards", phase: "Phase 3" },
  { name: "Certifications & Exams", desc: "Exam builder, question banks", phase: "Phase 4" },
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
            <span className="rounded-full border border-black/10 dark:border-white/15 px-2 py-0.5 text-foreground/70">
              {user.email}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 font-medium ${
                isAdmin
                  ? "bg-foreground text-background"
                  : "border border-black/10 dark:border-white/15 text-foreground/70"
              }`}
            >
              {membership?.role ?? "—"}
            </span>
          </div>
        </div>
        <form action={logout}>
          <button className="rounded-md border border-black/10 dark:border-white/15 px-3 py-1.5 text-sm hover:bg-black/[.04] dark:hover:bg-white/[.06]">
            Sign out
          </button>
        </form>
      </header>

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">Modules</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <div
              key={m.name}
              className="rounded-xl border border-black/10 dark:border-white/15 p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{m.name}</h3>
                <span className="text-xs text-foreground/50">{m.phase}</span>
              </div>
              <p className="mt-1 text-sm text-foreground/60">{m.desc}</p>
              <p className="mt-3 text-xs text-foreground/40">Coming soon</p>
            </div>
          ))}
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
