/**
 * Demo content seed for the Proxmox stakeholder testbed. Idempotent-ish: it renames
 * the existing workspace and fills it with a realistic, "lived-in" enterprise L&D team,
 * boards, projects, review cycles, milestones, time tracking, and storyboards.
 *
 *   DATABASE_URL=... npx tsx prisma/demo-seed.ts           # seed (skips if already present)
 *   DATABASE_URL=... DEMO_RESET=1 npx tsx prisma/demo-seed.ts   # wipe demo content + reseed
 *
 * Not committed — a deployment/demo utility only.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "@node-rs/argon2";
import { generateKeyBetween } from "fractional-indexing";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

const RESET = process.env.DEMO_RESET === "1";
const WORKSPACE_NAME = "Northwind Health — L&D";
const DEMO_DOMAIN = "northwind.example";
const DEMO_PASSWORD = "demo1234";
const MARKER_BOARD = "Course Production Pipeline";

// ── helpers ──────────────────────────────────────────────────────────────────
const now = new Date();
const day = (n: number) => new Date(now.getTime() + n * 86_400_000);

/** N ascending fractional-index position keys. */
function keys(n: number): string[] {
  const out: string[] = [];
  let prev: string | null = null;
  for (let i = 0; i < n; i++) { prev = generateKeyBetween(prev, null); out.push(prev); }
  return out;
}

// TipTap (StarterKit) document builders — rich-text fields are stored as JSON strings.
type Node = { type: string; content?: Node[]; text?: string };
const p = (text: string): Node => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });
const ul = (items: string[]): Node => ({
  type: "bulletList",
  content: items.map((t) => ({ type: "listItem", content: [p(t)] })),
});
const doc = (...blocks: Node[]): string => JSON.stringify({ type: "doc", content: blocks });

async function argon(pw: string) {
  return hash(pw, { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 });
}

// ── people ───────────────────────────────────────────────────────────────────
const TEAM = [
  { key: "priya", name: "Priya Nair", email: `priya.nair@${DEMO_DOMAIN}`, role: "ADMIN" as const },
  { key: "marcus", name: "Marcus Webb", email: `marcus.webb@${DEMO_DOMAIN}`, role: "MEMBER" as const },
  { key: "dana", name: "Dana Okafor", email: `dana.okafor@${DEMO_DOMAIN}`, role: "MEMBER" as const },
  { key: "sofia", name: "Sofia Reyes", email: `sofia.reyes@${DEMO_DOMAIN}`, role: "ADMIN" as const },
  { key: "lena", name: "Dr. Lena Fischer", email: `lena.fischer@${DEMO_DOMAIN}`, role: "MEMBER" as const },
  { key: "tom", name: "Tom Alvarez", email: `tom.alvarez@${DEMO_DOMAIN}`, role: "MEMBER" as const },
];

async function main() {
  const workspace = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  if (!workspace) throw new Error("No workspace found — run the base seed first.");

  const admin = await prisma.user.findFirst({
    where: { memberships: { some: { workspaceId: workspace.id, role: "ADMIN" } } },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) throw new Error("No admin user found in the workspace.");

  const existingMarker = await prisma.board.findFirst({ where: { workspaceId: workspace.id, name: MARKER_BOARD } });
  if (existingMarker && !RESET) {
    // Non-destructive top-up: add demo whiteboards to an existing demo without
    // wiping anything else (idempotent).
    await seedWhiteboards(workspace.id, admin.id);
    console.log("[demo] content already present — topped up whiteboards. Pass DEMO_RESET=1 to fully reseed.");
    return;
  }
  if (RESET) {
    console.log("[demo] DEMO_RESET=1 — clearing existing demo content…");
    await prisma.whiteboard.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.board.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.storyboard.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.project.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.user.deleteMany({ where: { email: { endsWith: `@${DEMO_DOMAIN}` } } });
  }

  // Give the workspace + admin a real identity.
  await prisma.workspace.update({ where: { id: workspace.id }, data: { name: WORKSPACE_NAME } });
  if (!admin.name || admin.name === "Admin") {
    await prisma.user.update({ where: { id: admin.id }, data: { name: "Jordan Ellis" } });
  }

  // Team members.
  const pwHash = await argon(DEMO_PASSWORD);
  const U: Record<string, string> = { admin: admin.id };
  for (const m of TEAM) {
    const u = await prisma.user.upsert({
      where: { email: m.email },
      update: { name: m.name },
      create: {
        email: m.email,
        name: m.name,
        passwordHash: pwHash,
        memberships: { create: { workspaceId: workspace.id, role: m.role } },
      },
    });
    U[m.key] = u.id;
  }
  console.log(`[demo] team: ${TEAM.length + 1} members`);

  await seedBoards(workspace.id, U);
  const storyboards = await seedStoryboards(workspace.id);
  await seedProjects(workspace.id, U, storyboards);
  await seedWhiteboards(workspace.id, admin.id);

  console.log("[demo] done.");
  console.log(`[demo] workspace renamed to "${WORKSPACE_NAME}"`);
  console.log(`[demo] team logins: <first>.<last>@${DEMO_DOMAIN} / ${DEMO_PASSWORD} (e.g. priya.nair@${DEMO_DOMAIN})`);
}

// ── boards ───────────────────────────────────────────────────────────────────
async function seedBoards(workspaceId: string, U: Record<string, string>) {
  // Board 1 — production pipeline.
  const cols1 = ["Backlog", "In Design", "In Development", "SME Review", "Published"];
  const labelDefs1 = [
    { name: "High priority", color: "#ef4444" },
    { name: "Medium", color: "#f59e0b" },
    { name: "Low", color: "#10b981" },
    { name: "Compliance", color: "#6366f1" },
    { name: "Sales", color: "#ec4899" },
    { name: "Onboarding", color: "#14b8a6" },
    { name: "Rework", color: "#f43f5e" },
  ];
  const b1 = await makeBoard(workspaceId, MARKER_BOARD, cols1, labelDefs1);

  await addCards(b1, "Backlog", U, [
    {
      title: "Microlearning: Phishing Red Flags",
      labels: ["Compliance", "Medium"], assignees: ["marcus"], due: day(21),
      desc: doc(p("A 5-minute microlearning refresher on spotting phishing attempts."),
        ul(["3–4 real-world email examples", "Interactive 'spot the red flag' hotspots", "Mobile-first, < 5 min"])),
    },
    { title: "Video: CEO Welcome Message", labels: ["Onboarding", "Low"], assignees: ["dana"], due: day(28) },
    { title: "Job Aid: Expense Report Quick Guide", labels: ["Low"], assignees: ["priya"] },
    { title: "Refresh: Workplace Safety 2026", labels: ["Compliance"], assignees: ["marcus"] },
  ]);

  await addCards(b1, "In Design", U, [
    {
      title: "Course: Data Privacy Essentials 2026",
      labels: ["Compliance", "High priority"], assignees: ["priya"], due: day(10),
      desc: doc(p("Annual mandatory data-privacy training, rebuilt for 2026 regulations."),
        p("Audience: all employees. Seat time target: 20 minutes.")),
      checklist: [
        { text: "Learning objectives approved", done: true },
        { text: "Content outline signed off by Legal", done: true },
        { text: "Storyboard drafted", done: true },
        { text: "Build in authoring tool", done: false },
        { text: "SME + Legal review", done: false },
      ],
      comments: [
        { by: "sofia", body: "Legal wants the breach-reporting section expanded — flagged to Lena." },
        { by: "priya", body: "Storyboard is in review now, build starts once Lena signs off." },
      ],
    },
    {
      title: "Course: Consultative Selling Skills",
      labels: ["Sales", "High priority"], assignees: ["dana"], due: day(18),
      desc: doc(p("Scenario-based course for the field sales team on consultative discovery.")),
      checklist: [
        { text: "Needs analysis with Sales VP", done: true },
        { text: "Objectives mapped to competencies", done: true },
        { text: "Discovery-call scenario storyboarded", done: false },
      ],
    },
  ]);

  await addCards(b1, "In Development", U, [
    {
      title: "Build: New Hire Onboarding — Module 2",
      labels: ["Onboarding", "High priority"], assignees: ["marcus"], due: day(7),
      desc: doc(p("Module 2 of 4: 'Your First Week' — systems, tools, and team norms.")),
      checklist: [
        { text: "Screens built (6 / 10)", done: false },
        { text: "Voiceover recorded", done: false },
        { text: "Accessibility pass (WCAG 2.2 AA)", done: false },
      ],
      comments: [{ by: "marcus", body: "6 of 10 screens built. Waiting on the CEO welcome video from Dana." }],
    },
    { title: "Build: Anti-Harassment Refresh", labels: ["Compliance", "Medium"], assignees: ["marcus"], due: day(12) },
  ]);

  await addCards(b1, "SME Review", U, [
    {
      title: "Review: Data Privacy — Legal sign-off",
      labels: ["Compliance", "High priority"], assignees: ["lena"], due: day(4),
      desc: doc(p("Clinical Compliance + Legal review of the Data Privacy storyboard before build.")),
      comments: [{ by: "lena", body: "Reviewing now — one change on the breach-reporting timeline, will note in the review cycle." }],
    },
    { title: "Review: Consultative Selling — Sales VP", labels: ["Sales", "Medium"], assignees: ["tom"], due: day(9) },
  ]);

  await addCards(b1, "Published", U, [
    { title: "Anti-Harassment Training 2025", labels: ["Compliance"], assignees: ["priya"] },
    { title: "Benefits Enrollment Guide", labels: ["Onboarding", "Low"], assignees: ["dana"] },
    { title: "Time & Attendance How-To", labels: ["Low"], assignees: ["marcus"] },
  ]);

  // Board 2 — onboarding program logistics.
  const cols2 = ["To Do", "In Progress", "Review", "Done"];
  const labelDefs2 = [
    { name: "Content", color: "#6366f1" },
    { name: "Logistics", color: "#f59e0b" },
    { name: "Tech", color: "#06b6d4" },
  ];
  const b2 = await makeBoard(workspaceId, "New-Hire Onboarding Program", cols2, labelDefs2);
  await addCards(b2, "To Do", U, [
    { title: "Draft Week 1 agenda", labels: ["Content"], assignees: ["priya"] },
    { title: "Design manager check-in template", labels: ["Content", "Logistics"], assignees: ["sofia"] },
  ]);
  await addCards(b2, "In Progress", U, [
    { title: "Record welcome videos", labels: ["Content"], assignees: ["dana"], due: day(14) },
    { title: "Build LMS enrollment automation", labels: ["Tech"], assignees: ["marcus"], due: day(9) },
  ]);
  await addCards(b2, "Review", U, [
    { title: "Buddy program guide — HR review", labels: ["Content"], assignees: ["sofia"], due: day(6) },
  ]);
  await addCards(b2, "Done", U, [
    { title: "New-hire survey finalized", labels: ["Content"], assignees: ["priya"] },
    { title: "Swag & workstation checklist", labels: ["Logistics"], assignees: ["marcus"] },
  ]);

  console.log("[demo] boards: 2 (with columns, labels, cards, checklists, comments)");
}

async function makeBoard(
  workspaceId: string, name: string, cols: string[], labelDefs: { name: string; color: string }[],
) {
  const colKeys = keys(cols.length);
  const board = await prisma.board.create({
    data: {
      workspaceId, name,
      columns: { create: cols.map((c, i) => ({ name: c, position: colKeys[i] })) },
      labels: { create: labelDefs },
    },
    include: { columns: true, labels: true },
  });
  const colByName = Object.fromEntries(board.columns.map((c) => [c.name, c.id]));
  const labelByName = Object.fromEntries(board.labels.map((l) => [l.name, l.id]));
  const counters: Record<string, string | null> = {};
  return { id: board.id, colByName, labelByName, counters };
}

type BoardCtx = { colByName: Record<string, string>; labelByName: Record<string, string>; counters: Record<string, string | null> };
type CardSpec = {
  title: string; labels?: string[]; assignees?: string[]; due?: Date; desc?: string;
  checklist?: { text: string; done: boolean }[]; comments?: { by: string; body: string }[];
};

async function addCards(board: BoardCtx, colName: string, U: Record<string, string>, cards: CardSpec[]) {
  const columnId = board.colByName[colName];
  for (const c of cards) {
    const pos = generateKeyBetween(board.counters[colName] ?? null, null);
    board.counters[colName] = pos;
    const clKeys = keys(c.checklist?.length ?? 0);
    await prisma.card.create({
      data: {
        columnId, title: c.title, position: pos, description: c.desc, dueDate: c.due,
        labels: c.labels ? { create: c.labels.map((n) => ({ labelId: board.labelByName[n] })) } : undefined,
        assignees: c.assignees ? { create: c.assignees.map((k) => ({ userId: U[k] })) } : undefined,
        subtasks: c.checklist ? { create: c.checklist.map((it, i) => ({ title: it.text, done: it.done, position: clKeys[i] })) } : undefined,
        comments: c.comments ? { create: c.comments.map((cm) => ({ authorId: U[cm.by], body: cm.body })) } : undefined,
      },
    });
  }
}

// ── storyboards ──────────────────────────────────────────────────────────────
type ScreenSpec = {
  title: string; type: string; onScreenText?: string; narration?: string;
  visualNotes?: string; interactionNotes?: string; developerNotes?: string;
};

async function makeStoryboard(workspaceId: string, title: string, status: string, description: string, screens: ScreenSpec[]) {
  const sKeys = keys(screens.length);
  const sb = await prisma.storyboard.create({
    data: {
      workspaceId, title, status, description,
      screens: {
        create: screens.map((s, i) => ({
          title: s.title, screenType: s.type, position: sKeys[i],
          onScreenText: s.onScreenText, narration: s.narration,
          visualNotes: s.visualNotes, interactionNotes: s.interactionNotes, developerNotes: s.developerNotes,
        })),
      },
    },
  });
  return sb.id;
}

async function seedStoryboards(workspaceId: string) {
  const privacy = await makeStoryboard(
    workspaceId, "Data Privacy Essentials 2026", "in_review",
    "Annual mandatory data-privacy training. 7 screens, ~20 min seat time.",
    [
      { title: "Welcome & Why Privacy Matters", type: "intro",
        onScreenText: doc(p("Data Privacy Essentials 2026"), p("Protecting our patients and each other.")),
        narration: doc(p("Every day, Northwind Health handles sensitive information. In the next 20 minutes you'll learn how to keep it safe — and what to do if something goes wrong.")),
        visualNotes: doc(p("Hero image: diverse care team. Brand-blue overlay, logo lower-right.")) },
      { title: "What Counts as Personal Data", type: "content",
        onScreenText: doc(p("Personal data is any information that can identify a person."), ul(["Names, addresses, and IDs", "Health and treatment records", "Financial and insurance details", "Even an IP address or photo"])),
        narration: doc(p("It's broader than most people think. When in doubt, treat it as personal data.")),
        visualNotes: doc(p("Animated icon grid; each item fades in on narration beat.")) },
      { title: "Your Responsibilities", type: "content",
        onScreenText: doc(ul(["Access only what you need", "Never share credentials", "Lock your screen", "Use approved systems only"])),
        narration: doc(p("Four habits protect nearly everything. Let's make them second nature.")) },
      { title: "Spot the PII", type: "knowledge_check",
        onScreenText: doc(p("Knowledge check: Which of the following is personal data?")),
        interactionNotes: doc(p("Multiple-response. Options: patient MRN (correct), aggregated ward statistics (incorrect), home email (correct), public press release (incorrect). Feedback per option.")) },
      { title: "Scenario: The Misdirected Email", type: "interaction",
        onScreenText: doc(p("You've just emailed a discharge summary to the wrong address. What do you do first?")),
        interactionNotes: doc(p("Branching scenario, 3 choices."), ul(["Recall the email and hope (leads to consequence branch)", "Report to your privacy officer immediately (best path)", "Delete your sent copy (incorrect)"])),
        developerNotes: doc(p("Track choice in a variable; show tailored feedback and route to the reporting screen.")) },
      { title: "Reporting a Breach", type: "content",
        onScreenText: doc(p("Report within 1 hour."), ul(["Contact your Privacy Officer", "Do not attempt to 'fix' it yourself", "Document what happened"])),
        narration: doc(p("Fast reporting limits harm and is required by law. There is never a penalty for reporting in good faith.")),
        developerNotes: doc(p("Legal (Lena) requested the 1-hour timeline be explicit — updated 2026 requirement.")) },
      { title: "Key Takeaways & Resources", type: "summary",
        onScreenText: doc(ul(["Treat identifiable info as personal data", "Practice the four daily habits", "Report breaches within 1 hour"])),
        narration: doc(p("Thanks for helping keep Northwind Health trustworthy. Links below go to the policy hub and your Privacy Officer directory.")) },
    ],
  );

  const selling = await makeStoryboard(
    workspaceId, "Consultative Selling — Discovery Call", "draft",
    "Scenario-driven practice for the discovery phase of a consultative sale.",
    [
      { title: "The Discovery Mindset", type: "intro",
        onScreenText: doc(p("Great selling starts with great questions.")),
        narration: doc(p("In this scenario you'll run a discovery call with a hesitant prospect.")) },
      { title: "Meet the Prospect", type: "content",
        onScreenText: doc(p("Alex runs operations at a 200-bed clinic and is skeptical of 'another vendor'.")),
        visualNotes: doc(p("Character card for Alex; office background.")) },
      { title: "Your Opening Question", type: "interaction",
        onScreenText: doc(p("How do you open?")),
        interactionNotes: doc(p("3 choices ranging from pushy pitch to open-ended discovery; best answer is the open question.")) },
      { title: "Reading the Signals", type: "interaction",
        onScreenText: doc(p("Alex mentions staffing pain. What do you do?")),
        interactionNotes: doc(p("Branch: dig deeper vs. jump to product. Dig-deeper path unlocks the win.")) },
      { title: "Debrief & Takeaways", type: "summary",
        onScreenText: doc(ul(["Lead with open questions", "Follow the pain, not the pitch", "Summarize before proposing"])) },
    ],
  );

  const welcome = await makeStoryboard(
    workspaceId, "New Hire: Welcome Module", "approved",
    "Warm, 8-minute welcome for day one. Approved and in production.",
    [
      { title: "Welcome to Northwind", type: "intro", onScreenText: doc(p("We're so glad you're here.")) },
      { title: "Meet Your Team", type: "content", onScreenText: doc(p("A quick tour of who does what and where to get help.")) },
      { title: "A Word from our CEO", type: "video", onScreenText: doc(p("2-minute welcome video.")), developerNotes: doc(p("Awaiting final cut from Dana.")) },
      { title: "Your First Week", type: "summary", onScreenText: doc(ul(["Set up your workstation", "Meet your buddy", "Complete required training"])) },
    ],
  );

  console.log("[demo] storyboards: 3 (with rich per-screen fields)");
  return { privacy, selling, welcome };
}

// ── projects ─────────────────────────────────────────────────────────────────
type PhaseSpec = { name: string; status: string; start?: Date; end?: Date };
type DeliverableSpec = {
  name: string; type: string; status: string; phase?: string; storyboardId?: string;
  reviews?: { by: string; round: number; status: string; due?: Date; feedback?: string }[];
};
type MilestoneSpec = { name: string; due?: Date; completed?: Date };
type ProjectSpec = {
  name: string; methodology: "ADDIE" | "SAM" | "CUSTOM"; status: string; description: string;
  phases: PhaseSpec[]; deliverables: DeliverableSpec[]; milestones: MilestoneSpec[];
  time: { by: string; minutes: number; note: string; for: Date; deliverable?: string }[];
};

async function seedProjects(
  workspaceId: string, U: Record<string, string>,
  sb: { privacy: string; selling: string; welcome: string },
) {
  const projects: ProjectSpec[] = [
    {
      name: "New Hire Onboarding Revamp", methodology: "ADDIE", status: "active",
      description: "End-to-end rebuild of the new-hire experience: 4 modules, buddy program, and a 30/60/90 check-in cadence.",
      phases: [
        { name: "Analyze", status: "done", start: day(-60), end: day(-46) },
        { name: "Design", status: "done", start: day(-45), end: day(-24) },
        { name: "Develop", status: "in_progress", start: day(-23) },
        { name: "Implement", status: "not_started" },
        { name: "Evaluate", status: "not_started" },
      ],
      deliverables: [
        { name: "Welcome Module storyboard", type: "storyboard", status: "complete", phase: "Design", storyboardId: sb.welcome,
          reviews: [{ by: "sofia", round: 1, status: "approved", due: day(-28), feedback: "Warm and on-brand. Approved." }] },
        { name: "Module 2 course build", type: "course", status: "in_progress", phase: "Develop" },
        { name: "Onboarding facilitator guide", type: "document", status: "in_progress", phase: "Develop" },
      ],
      milestones: [
        { name: "Project kickoff", completed: day(-60) },
        { name: "Design sign-off", completed: day(-24) },
        { name: "Pilot cohort launch", due: day(21) },
      ],
      time: [
        { by: "priya", minutes: 240, note: "Needs analysis + stakeholder interviews", for: day(-55) },
        { by: "dana", minutes: 180, note: "Welcome module storyboard", for: day(-30), deliverable: "Welcome Module storyboard" },
        { by: "marcus", minutes: 300, note: "Module 2 build", for: day(-5), deliverable: "Module 2 course build" },
      ],
    },
    {
      name: "Data Privacy Essentials 2026", methodology: "SAM", status: "active",
      description: "Annual mandatory refresh, rebuilt for 2026 regulations with an updated breach-reporting timeline.",
      phases: [
        { name: "Preparation", status: "done", start: day(-30), end: day(-21) },
        { name: "Iterative Design", status: "in_progress", start: day(-20) },
        { name: "Iterative Development", status: "not_started" },
      ],
      deliverables: [
        { name: "Data Privacy storyboard", type: "storyboard", status: "in_review", phase: "Iterative Design", storyboardId: sb.privacy,
          reviews: [
            { by: "admin", round: 1, status: "requested", due: day(4) },          // → admin's dashboard review queue
            { by: "lena", round: 1, status: "in_review", due: day(3), feedback: "One change on the breach-reporting timeline." },
          ] },
        { name: "Course build", type: "course", status: "not_started", phase: "Iterative Development" },
      ],
      milestones: [
        { name: "Legal review complete", due: day(6) },
        { name: "Launch to all staff", due: day(40) },
      ],
      time: [
        { by: "priya", minutes: 150, note: "Objectives + outline with Legal", for: day(-18) },
        { by: "priya", minutes: 210, note: "Storyboard drafting", for: day(-3), deliverable: "Data Privacy storyboard" },
      ],
    },
    {
      name: "Consultative Selling Skills", methodology: "ADDIE", status: "active",
      description: "Scenario-based skills course for the field sales team, built around a realistic discovery call.",
      phases: [
        { name: "Analyze", status: "done", start: day(-25), end: day(-16) },
        { name: "Design", status: "in_progress", start: day(-15) },
        { name: "Develop", status: "not_started" },
        { name: "Implement", status: "not_started" },
        { name: "Evaluate", status: "not_started" },
      ],
      deliverables: [
        { name: "Discovery-call scenario storyboard", type: "storyboard", status: "in_progress", phase: "Design", storyboardId: sb.selling,
          reviews: [
            { by: "tom", round: 1, status: "requested", due: day(9) },
            { by: "admin", round: 1, status: "in_review", due: day(2) },        // second item in admin's queue
          ] },
        { name: "Facilitator deck", type: "document", status: "not_started", phase: "Develop" },
      ],
      milestones: [{ name: "Content lock", due: day(14) }, { name: "Cohort 1 delivery", due: day(52) }],
      time: [{ by: "dana", minutes: 190, note: "Discovery scenario storyboard", for: day(-2), deliverable: "Discovery-call scenario storyboard" }],
    },
    {
      name: "Leadership Essentials Cohort", methodology: "CUSTOM", status: "on_hold",
      description: "Blended cohort program for new people-managers. On hold pending 2026 budget approval.",
      phases: [
        { name: "Discovery", status: "done", start: day(-40), end: day(-30) },
        { name: "Curriculum design", status: "in_progress", start: day(-29) },
      ],
      deliverables: [{ name: "Curriculum map", type: "document", status: "in_progress", phase: "Curriculum design" }],
      milestones: [{ name: "Budget approval", due: day(18) }, { name: "Cohort 1 start", due: day(45) }],
      time: [{ by: "sofia", minutes: 120, note: "Competency framework research", for: day(-35) }],
    },
    {
      name: "Annual Compliance Refresh 2025", methodology: "ADDIE", status: "completed",
      description: "Last year's mandatory compliance suite. Delivered on time; archived for reference.",
      phases: [
        { name: "Analyze", status: "done", start: day(-320), end: day(-305) },
        { name: "Design", status: "done", start: day(-304), end: day(-280) },
        { name: "Develop", status: "done", start: day(-279), end: day(-250) },
        { name: "Implement", status: "done", start: day(-249), end: day(-235) },
        { name: "Evaluate", status: "done", start: day(-234), end: day(-220) },
      ],
      deliverables: [
        { name: "Compliance course suite", type: "course", status: "complete", phase: "Develop",
          reviews: [{ by: "lena", round: 2, status: "approved", due: day(-260), feedback: "All regulatory points covered. Approved." }] },
      ],
      milestones: [{ name: "Launch", completed: day(-235) }, { name: "95% completion", completed: day(-210) }],
      time: [{ by: "priya", minutes: 480, note: "Full ADDIE cycle", for: day(-300) }],
    },
  ];

  for (const spec of projects) {
    const phaseKeys = keys(spec.phases.length);
    const delivKeys = keys(spec.deliverables.length);
    const mileKeys = keys(spec.milestones.length);

    const project = await prisma.project.create({
      data: {
        workspaceId, name: spec.name, methodology: spec.methodology, status: spec.status, description: spec.description,
        phases: { create: spec.phases.map((ph, i) => ({ name: ph.name, status: ph.status, position: phaseKeys[i], startDate: ph.start, endDate: ph.end })) },
        milestones: { create: spec.milestones.map((m, i) => ({ name: m.name, position: mileKeys[i], dueDate: m.due, completedAt: m.completed })) },
      },
      include: { phases: true },
    });
    const phaseByName = Object.fromEntries(project.phases.map((ph) => [ph.name, ph.id]));

    const delivIdByName: Record<string, string> = {};
    for (let i = 0; i < spec.deliverables.length; i++) {
      const d = spec.deliverables[i];
      const deliverable = await prisma.deliverable.create({
        data: {
          projectId: project.id, name: d.name, type: d.type, status: d.status, position: delivKeys[i],
          phaseId: d.phase ? phaseByName[d.phase] : undefined,
          reviewCycles: d.reviews ? {
            create: d.reviews.map((r) => ({
              reviewerId: U[r.by],
              // The lead ID (admin) requests SME/stakeholder reviews; reviews that
              // land on the admin are requested by another admin (Sofia).
              requestedById: U[r.by === "admin" ? "sofia" : "admin"],
              round: r.round, status: r.status, dueDate: r.due, feedback: r.feedback,
            })),
          } : undefined,
        },
      });
      delivIdByName[d.name] = deliverable.id;
      // Link the storyboard back to its deliverable (unique 1:1).
      if (d.storyboardId) {
        await prisma.storyboard.update({ where: { id: d.storyboardId }, data: { deliverableId: deliverable.id } });
      }
    }

    if (spec.time.length) {
      await prisma.timeEntry.createMany({
        data: spec.time.map((t) => ({
          projectId: project.id, userId: U[t.by], minutes: t.minutes, note: t.note, loggedFor: t.for,
          deliverableId: t.deliverable ? delivIdByName[t.deliverable] : null,
        })),
      });
    }
  }
  console.log(`[demo] projects: ${projects.length} (phases, deliverables, review cycles, milestones, time)`);
}

// ── whiteboards ──────────────────────────────────────────────────────────────
// Minimal hand-built Excalidraw scenes so the demo whiteboards aren't blank. The
// element shape matches serializeAsJSON output (elements + appState + files).

let _eid = 0;
type Ex = Record<string, unknown>;
function base(type: string, props: Ex): Ex {
  _eid++;
  return {
    id: `demo-${_eid}`,
    type,
    x: 0, y: 0, width: 100, height: 60, angle: 0,
    strokeColor: "#1e1e1e", backgroundColor: "transparent",
    fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid",
    roughness: 1, opacity: 100, groupIds: [], frameId: null,
    roundness: null, seed: _eid * 100003, version: 1, versionNonce: _eid * 200003,
    isDeleted: false, boundElements: null, updated: 1, link: null, locked: false,
    ...props,
  };
}
function rectEl(x: number, y: number, w: number, h: number, extra: Ex = {}): Ex {
  return base("rectangle", { x, y, width: w, height: h, roundness: { type: 3 }, ...extra });
}
function textEl(x: number, y: number, str: string, size = 16, extra: Ex = {}): Ex {
  return base("text", {
    x, y, width: Math.max(20, str.length * size * 0.55), height: size * 1.25,
    text: str, fontSize: size, fontFamily: 1, textAlign: "left", verticalAlign: "top",
    containerId: null, originalText: str, lineHeight: 1.25, baseline: size, ...extra,
  });
}
function arrowEl(x: number, y: number, dx: number, dy: number, extra: Ex = {}): Ex {
  return base("arrow", {
    x, y, width: Math.abs(dx), height: Math.abs(dy),
    points: [[0, 0], [dx, dy]], lastCommittedPoint: null,
    startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: "arrow", ...extra,
  });
}
function excalidraw(elements: Ex[]): string {
  return JSON.stringify({
    type: "excalidraw", version: 2, source: "idstudio-demo",
    elements, appState: { viewBackgroundColor: "#ffffff", gridSize: null }, files: {},
  });
}

// A labelled box = a rectangle + a centered text element.
function boxWithLabel(x: number, y: number, w: number, h: number, label: string, extra: Ex = {}): Ex[] {
  return [
    rectEl(x, y, w, h, extra),
    textEl(x + 12, y + h / 2 - 10, label, 16),
  ];
}

async function seedWhiteboards(workspaceId: string, ownerId: string) {
  const MARKER = "New-Hire Onboarding — Flow";
  const existing = await prisma.whiteboard.findFirst({ where: { workspaceId, title: MARKER } });
  if (existing) return; // idempotent

  const welcomeSb = await prisma.storyboard.findFirst({
    where: { workspaceId, title: "New Hire: Welcome Module" },
    select: { id: true },
  });

  // 1) Onboarding flow (linked to the Welcome storyboard).
  const flow: Ex[] = [
    textEl(220, 40, "New-Hire Onboarding Flow", 28),
    ...boxWithLabel(240, 100, 220, 64, "Offer accepted"),
    arrowEl(350, 168, 0, 44),
    ...boxWithLabel(240, 216, 220, 64, "Day 1 · Welcome & setup"),
    arrowEl(350, 284, 0, 44),
    ...boxWithLabel(240, 332, 220, 64, "Week 1 · Core training"),
    arrowEl(350, 400, 0, 44),
    ...boxWithLabel(240, 448, 220, 64, "30 / 60 / 90 check-ins"),
    arrowEl(460, 480, 120, 0),
    ...boxWithLabel(600, 448, 200, 64, "Manager sign-off", { strokeColor: "#2f9e44" }),
  ];

  // 2) Course player wireframe.
  const wireframe: Ex[] = [
    textEl(120, 40, "Course Player — Wireframe", 24),
    rectEl(120, 90, 560, 360),
    ...boxWithLabel(120, 90, 560, 48, "Course title  ·  progress"),
    ...boxWithLabel(120, 138, 150, 312, "Menu"),
    ...boxWithLabel(270, 138, 410, 250, "Lesson content"),
    ...boxWithLabel(560, 398, 120, 44, "Next →", { backgroundColor: "#a5d8ff" }),
  ];

  // 3) Assessment brainstorm — sticky notes.
  const brainstorm: Ex[] = [
    textEl(140, 40, "Assessment Ideas", 24),
    ...boxWithLabel(140, 100, 200, 100, "Scenario-based Qs", { backgroundColor: "#ffec99" }),
    ...boxWithLabel(370, 100, 200, 100, "Drag & drop match", { backgroundColor: "#b2f2bb" }),
    ...boxWithLabel(140, 230, 200, 100, "Branching sim", { backgroundColor: "#a5d8ff" }),
    ...boxWithLabel(370, 230, 200, 100, "Per-module checks", { backgroundColor: "#ffc9c9" }),
  ];

  await prisma.whiteboard.createMany({
    data: [
      { workspaceId, createdById: ownerId, storyboardId: welcomeSb?.id ?? null, title: MARKER, scene: excalidraw(flow) },
      { workspaceId, createdById: ownerId, title: "Course Player Wireframe", scene: excalidraw(wireframe) },
      { workspaceId, createdById: ownerId, title: "Assessment Ideas — Brainstorm", scene: excalidraw(brainstorm) },
    ],
  });
  console.log(`[demo] whiteboards: 3 (with example Excalidraw scenes)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("[demo] failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
