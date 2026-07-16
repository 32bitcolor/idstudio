/**
 * Demo content seed for the "JumpCloud Customer Education" workspace — a
 * stakeholder-review demo showing IDStudio populated the way a real customer
 * education team would use it: people, groups, boards, projects, storyboards,
 * whiteboards, and an intake queue in a mix of states.
 *
 * Targets the workspace by slug (not "first workspace" — this repo already has
 * an unrelated Northwind Health demo workspace seeded by prisma/demo-seed.ts).
 * The admin (Ella Rigoulot) must already exist; this script only adds to her
 * workspace, never renames/touches her account.
 *
 *   DATABASE_URL=... npx tsx prisma/jumpcloud-demo-seed.ts
 *   DATABASE_URL=... DEMO_RESET=1 npx tsx prisma/jumpcloud-demo-seed.ts   # wipe + reseed
 *
 * Committed as a utility script, same as prisma/demo-seed.ts — not part of the
 * app's runtime or build.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "@node-rs/argon2";
import { generateKeyBetween } from "fractional-indexing";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

const RESET = process.env.DEMO_RESET === "1";
const WORKSPACE_SLUG = process.env.DEMO_WORKSPACE_SLUG ?? "jumpcloud-customer-education";
const DEMO_DOMAIN = "jumpcloud.com";
const DEMO_PASSWORD = "demo1234";
const MARKER_BOARD = "Course Production Pipeline";

// ── helpers ──────────────────────────────────────────────────────────────────
const now = new Date();
const day = (n: number) => new Date(now.getTime() + n * 86_400_000);

function keys(n: number): string[] {
  const out: string[] = [];
  let prev: string | null = null;
  for (let i = 0; i < n; i++) { prev = generateKeyBetween(prev, null); out.push(prev); }
  return out;
}

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
  { key: "priya", name: "Priya Anand", email: `priya.anand@${DEMO_DOMAIN}`, role: "ADMIN" as const },
  { key: "jordan", name: "Jordan Kim", email: `jordan.kim@${DEMO_DOMAIN}`, role: "MEMBER" as const },
  { key: "sam", name: "Sam Okoye", email: `sam.okoye@${DEMO_DOMAIN}`, role: "MEMBER" as const },
  { key: "devon", name: "Devon Marsh", email: `devon.marsh@${DEMO_DOMAIN}`, role: "MEMBER" as const },
  { key: "riley", name: "Riley Chen", email: `riley.chen@${DEMO_DOMAIN}`, role: "MEMBER" as const },
];

async function main() {
  const workspace = await prisma.workspace.findUnique({ where: { slug: WORKSPACE_SLUG } });
  if (!workspace) throw new Error(`No workspace with slug "${WORKSPACE_SLUG}" — create it first.`);

  const admin = await prisma.user.findFirst({
    where: { memberships: { some: { workspaceId: workspace.id, role: "ADMIN" } } },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) throw new Error("No admin user found in the workspace.");

  const existingMarker = await prisma.board.findFirst({ where: { workspaceId: workspace.id, name: MARKER_BOARD } });
  if (existingMarker && !RESET) {
    console.log("[demo] content already present — pass DEMO_RESET=1 to fully reseed.");
    return;
  }
  if (RESET) {
    console.log("[demo] DEMO_RESET=1 — clearing existing demo content…");
    await prisma.intakeRequest.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.whiteboard.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.board.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.storyboard.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.project.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.group.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.user.deleteMany({ where: { email: { endsWith: `@${DEMO_DOMAIN}` }, id: { not: admin.id } } });
  }

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

  await seedGroups(workspace.id, U);
  await seedBoards(workspace.id, U);
  const storyboards = await seedStoryboards(workspace.id);
  await seedProjects(workspace.id, U, storyboards);
  await seedWhiteboards(workspace.id, admin.id);
  await seedIntake(workspace.id, U);

  console.log("[demo] done.");
  console.log(`[demo] team logins: <first>.<last>@${DEMO_DOMAIN} / ${DEMO_PASSWORD} (e.g. priya.anand@${DEMO_DOMAIN})`);
}

// ── groups ───────────────────────────────────────────────────────────────────
async function seedGroups(workspaceId: string, U: Record<string, string>) {
  await prisma.group.create({
    data: {
      workspaceId, name: "Instructional Designers",
      description: "Course, storyboard, and job-aid authors.",
      members: { create: [U.priya, U.jordan, U.sam].map((userId) => ({ userId })) },
    },
  });
  await prisma.group.create({
    data: {
      workspaceId, name: "Product SMEs",
      description: "Subject-matter reviewers pulled in for accuracy passes.",
      members: { create: [{ userId: U.devon }] },
    },
  });
  await prisma.group.create({
    data: {
      workspaceId, name: "Program Management",
      description: "Roadmap, scheduling, and stakeholder reporting.",
      members: { create: [U.riley, U.admin].map((userId) => ({ userId })) },
    },
  });
  console.log("[demo] groups: 3 (with membership)");
}

// ── boards ───────────────────────────────────────────────────────────────────
async function seedBoards(workspaceId: string, U: Record<string, string>) {
  const cols1 = ["Backlog", "In Design", "In Development", "SME Review", "Published"];
  const labelDefs1 = [
    { name: "High priority", color: "#ef4444" },
    { name: "Medium", color: "#f59e0b" },
    { name: "Low", color: "#10b981" },
    { name: "Certification", color: "#6366f1" },
    { name: "New feature", color: "#ec4899" },
    { name: "Onboarding", color: "#14b8a6" },
    { name: "Rework", color: "#f43f5e" },
  ];
  const b1 = await makeBoard(workspaceId, MARKER_BOARD, cols1, labelDefs1);

  await addCards(b1, "Backlog", U, [
    {
      title: "Microlearning: Conditional Access Basics",
      labels: ["New feature", "Medium"], assignees: ["jordan"], due: day(21),
      desc: doc(p("A 5-minute refresher on setting up Conditional Access policies."),
        ul(["Policy builder walkthrough", "Common policy templates", "Mobile-first, < 5 min"])),
    },
    { title: "Video: What's New in the Admin Console", labels: ["Onboarding", "Low"], assignees: ["sam"], due: day(28) },
    { title: "Job Aid: Device Enrollment Quick Guide", labels: ["Low"], assignees: ["priya"] },
    { title: "Refresh: RADIUS Setup Walkthrough", labels: ["Rework"], assignees: ["jordan"] },
  ]);

  await addCards(b1, "In Design", U, [
    {
      title: "Course: JumpCloud Admin Certification — Module 1",
      labels: ["Certification", "High priority"], assignees: ["priya"], due: day(10),
      desc: doc(p("Foundations module for the Admin Certification track: directory, users, groups."),
        p("Audience: new admins. Seat time target: 25 minutes.")),
      checklist: [
        { text: "Learning objectives approved", done: true },
        { text: "Content outline signed off by Product", done: true },
        { text: "Storyboard drafted", done: true },
        { text: "Build in authoring tool", done: false },
        { text: "SME review", done: false },
      ],
      comments: [
        { by: "devon", body: "Directory Insights section needs the new UI screenshots — will send today." },
        { by: "priya", body: "Storyboard is in review now, build starts once Devon signs off." },
      ],
    },
    {
      title: "Course: SSO & SAML Deep Dive",
      labels: ["New feature", "High priority"], assignees: ["sam"], due: day(18),
      desc: doc(p("Scenario-based course walking admins through a real SSO app integration.")),
      checklist: [
        { text: "Needs analysis with Support", done: true },
        { text: "Objectives mapped to cert exam blueprint", done: true },
        { text: "App-integration scenario storyboarded", done: false },
      ],
    },
  ]);

  await addCards(b1, "In Development", U, [
    {
      title: "Build: Device Management Fundamentals — Module 2",
      labels: ["Onboarding", "High priority"], assignees: ["jordan"], due: day(7),
      desc: doc(p("Module 2 of 4: enrolling and configuring policies across macOS/Windows/Linux.")),
      checklist: [
        { text: "Screens built (6 / 10)", done: false },
        { text: "Voiceover recorded", done: false },
        { text: "Accessibility pass (WCAG 2.2 AA)", done: false },
      ],
      comments: [{ by: "jordan", body: "6 of 10 screens built. Waiting on the updated console screenshots from Devon." }],
    },
    { title: "Build: Password Manager Rollout Guide", labels: ["New feature", "Medium"], assignees: ["sam"], due: day(12) },
  ]);

  await addCards(b1, "SME Review", U, [
    {
      title: "Review: Admin Certification Module 1 — Product sign-off",
      labels: ["Certification", "High priority"], assignees: ["devon"], due: day(4),
      desc: doc(p("Product review of the Certification Module 1 storyboard before build.")),
      comments: [{ by: "devon", body: "Reviewing now — one note on the Directory Insights screen, will log in the review cycle." }],
    },
    { title: "Review: SSO & SAML Deep Dive — Support VP", labels: ["New feature", "Medium"], assignees: ["riley"], due: day(9) },
  ]);

  await addCards(b1, "Published", U, [
    { title: "System Insights Overview", labels: ["Certification"], assignees: ["priya"] },
    { title: "Admin Console Onboarding Video", labels: ["Onboarding", "Low"], assignees: ["sam"] },
    { title: "Zero Trust Quick Start", labels: ["Low"], assignees: ["jordan"] },
  ]);

  const cols2 = ["To Do", "In Progress", "Review", "Done"];
  const labelDefs2 = [
    { name: "Content", color: "#6366f1" },
    { name: "Exam ops", color: "#f59e0b" },
    { name: "Tech", color: "#06b6d4" },
  ];
  const b2 = await makeBoard(workspaceId, "Certification Program Ops", cols2, labelDefs2);
  await addCards(b2, "To Do", U, [
    { title: "Draft exam blueprint v2", labels: ["Exam ops"], assignees: ["priya"] },
    { title: "Design digital badge artwork", labels: ["Content"], assignees: ["riley"] },
  ]);
  await addCards(b2, "In Progress", U, [
    { title: "Write question bank — Directory module", labels: ["Content"], assignees: ["jordan"], due: day(14) },
    { title: "Proctor tool integration", labels: ["Tech"], assignees: ["sam"], due: day(9) },
  ]);
  await addCards(b2, "Review", U, [
    { title: "Question bank — SME accuracy pass", labels: ["Content"], assignees: ["devon"], due: day(6) },
  ]);
  await addCards(b2, "Done", U, [
    { title: "Certification landing page copy", labels: ["Content"], assignees: ["riley"] },
    { title: "Exam retake policy finalized", labels: ["Exam ops"], assignees: ["priya"] },
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
  const sso = await makeStoryboard(
    workspaceId, "SSO Setup Walkthrough", "in_review",
    "Screen-by-screen walkthrough of configuring SSO for a new application. 7 screens, ~18 min seat time.",
    [
      { title: "Welcome & Why SSO Matters", type: "intro",
        onScreenText: doc(p("SSO Setup Walkthrough"), p("One login, every app, fewer support tickets.")),
        narration: doc(p("In the next 18 minutes you'll configure SSO for a real application end to end — from app catalog to first successful login.")),
        visualNotes: doc(p("Hero: admin console dashboard. Brand-blue overlay, logo lower-right.")) },
      { title: "Choosing an App from the Catalog", type: "content",
        onScreenText: doc(p("JumpCloud's SSO catalog includes thousands of pre-configured apps."), ul(["Search the catalog first", "Use SAML or OIDC for anything custom", "Check the app's own SSO docs for edge cases"])),
        narration: doc(p("Most apps just work out of the box. Custom apps need a little more setup — we'll cover both.")),
        visualNotes: doc(p("Animated catalog search; results fade in on narration beat.")) },
      { title: "Configuring the SAML Connection", type: "content",
        onScreenText: doc(ul(["Enter the app's ACS URL and Entity ID", "Map user attributes", "Set the signing certificate"])),
        narration: doc(p("These three fields cover 90% of SAML setups. Get them right and everything downstream just works.")) },
      { title: "Knowledge Check: SAML vs. OIDC", type: "knowledge_check",
        onScreenText: doc(p("Knowledge check: which protocol would you choose for a legacy on-prem app with no OIDC support?")),
        interactionNotes: doc(p("Single-select. Options: SAML (correct), OIDC (incorrect), RADIUS (incorrect). Feedback per option explains why.")) },
      { title: "Scenario: The Failed Login", type: "interaction",
        onScreenText: doc(p("A user reports they can't log into the newly-connected app. Where do you look first?")),
        interactionNotes: doc(p("Branching scenario, 3 choices."), ul(["Check the SSO event log (best path)", "Reset the user's password (incorrect, unrelated)", "Re-enter the SAML certificate (leads to a longer diagnostic branch)"])),
        developerNotes: doc(p("Track choice in a variable; show tailored feedback and route to the troubleshooting screen.")) },
      { title: "Reading the SSO Event Log", type: "content",
        onScreenText: doc(p("The event log shows you exactly where a login attempt failed."), ul(["Filter by app or user", "Look for attribute-mapping errors first", "Export logs for support escalations"])),
        narration: doc(p("Nine times out of ten, the event log tells you exactly what's wrong.")),
        developerNotes: doc(p("Support (Devon) requested this screen be added after seeing repeat tickets — 2026 addition.")) },
      { title: "Key Takeaways & Resources", type: "summary",
        onScreenText: doc(ul(["Search the catalog before building custom", "Get ACS URL, Entity ID, and attribute mapping right", "The event log is your first stop for troubleshooting"])),
        narration: doc(p("Thanks for completing SSO setup training. Links below go to the SAML reference docs and the support escalation path.")) },
    ],
  );

  const devices = await makeStoryboard(
    workspaceId, "Device Management Fundamentals", "draft",
    "Foundational course on enrolling and managing devices across macOS, Windows, and Linux.",
    [
      { title: "Why Device Management", type: "intro",
        onScreenText: doc(p("Every device is a door. Let's make sure only the right people walk through.")),
        narration: doc(p("In this module you'll enroll a device and apply your first policy.")) },
      { title: "Enrolling a Device", type: "content",
        onScreenText: doc(p("Enrollment links a device to a user and the org's policies.")),
        visualNotes: doc(p("Step-by-step console screenshots — macOS enrollment flow.")) },
      { title: "Your First Policy", type: "interaction",
        onScreenText: doc(p("Which policy would you apply first for a new fleet?")),
        interactionNotes: doc(p("3 choices ranging from disk encryption to screen-lock timeout; best answer is disk encryption for a new fleet.")) },
      { title: "Cross-Platform Gotchas", type: "content",
        onScreenText: doc(ul(["Policy support varies by OS", "Linux has the smallest policy surface today", "Always test on one device before fleet-wide rollout"])) },
      { title: "Debrief & Takeaways", type: "summary",
        onScreenText: doc(ul(["Enrollment links device to policy", "Start with disk encryption", "Pilot before you push fleet-wide"])) },
    ],
  );

  const consoleTour = await makeStoryboard(
    workspaceId, "Welcome to JumpCloud: Admin Console Tour", "approved",
    "Warm, 8-minute orientation for brand-new admins. Approved and in production.",
    [
      { title: "Welcome to JumpCloud", type: "intro", onScreenText: doc(p("Let's get you oriented.")) },
      { title: "The Admin Console at a Glance", type: "content", onScreenText: doc(p("A quick tour of Directory, Devices, SSO, and Insights.")) },
      { title: "A Word from our Customer Success Team", type: "video", onScreenText: doc(p("2-minute welcome video.")), developerNotes: doc(p("Awaiting final cut from Sam.")) },
      { title: "Your First Week Checklist", type: "summary", onScreenText: doc(ul(["Invite your team", "Enroll your first device", "Connect your first app via SSO"])) },
    ],
  );

  console.log("[demo] storyboards: 3 (with rich per-screen fields)");
  return { sso, devices, consoleTour };
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
  sb: { sso: string; devices: string; consoleTour: string },
) {
  const projects: ProjectSpec[] = [
    {
      name: "JumpCloud Admin Certification Program", methodology: "ADDIE", status: "active",
      description: "End-to-end certification track for JumpCloud admins: 4 modules, exam, and a digital badge.",
      phases: [
        { name: "Analyze", status: "done", start: day(-60), end: day(-46) },
        { name: "Design", status: "done", start: day(-45), end: day(-24) },
        { name: "Develop", status: "in_progress", start: day(-23) },
        { name: "Implement", status: "not_started" },
        { name: "Evaluate", status: "not_started" },
      ],
      deliverables: [
        { name: "Admin Console Tour storyboard", type: "storyboard", status: "complete", phase: "Design", storyboardId: sb.consoleTour,
          reviews: [{ by: "devon", round: 1, status: "approved", due: day(-28), feedback: "Warm and on-brand. Approved." }] },
        { name: "Module 1 course build", type: "other", status: "in_progress", phase: "Develop" },
        { name: "Certification exam question bank", type: "assessment", status: "in_progress", phase: "Develop" },
      ],
      milestones: [
        { name: "Project kickoff", completed: day(-60) },
        { name: "Design sign-off", completed: day(-24) },
        { name: "Pilot cohort launch", due: day(21) },
      ],
      time: [
        { by: "priya", minutes: 240, note: "Needs analysis + stakeholder interviews", for: day(-55) },
        { by: "sam", minutes: 180, note: "Admin Console Tour storyboard", for: day(-30), deliverable: "Admin Console Tour storyboard" },
        { by: "jordan", minutes: 300, note: "Module 1 build", for: day(-5), deliverable: "Module 1 course build" },
      ],
    },
    {
      name: "SSO & Conditional Access Course Refresh", methodology: "SAM", status: "active",
      description: "Refresh of the SSO course to cover the new Conditional Access policy builder.",
      phases: [
        { name: "Preparation", status: "done", start: day(-30), end: day(-21) },
        { name: "Iterative Design", status: "in_progress", start: day(-20) },
        { name: "Iterative Development", status: "not_started" },
      ],
      deliverables: [
        { name: "SSO Setup storyboard", type: "storyboard", status: "in_review", phase: "Iterative Design", storyboardId: sb.sso,
          reviews: [
            { by: "admin", round: 1, status: "requested", due: day(4) },
            { by: "devon", round: 1, status: "in_review", due: day(3), feedback: "One note on the event-log screen." },
          ] },
        { name: "Course build", type: "other", status: "not_started", phase: "Iterative Development" },
      ],
      milestones: [
        { name: "Product review complete", due: day(6) },
        { name: "Launch to all customers", due: day(40) },
      ],
      time: [
        { by: "priya", minutes: 150, note: "Objectives + outline with Product", for: day(-18) },
        { by: "priya", minutes: 210, note: "Storyboard drafting", for: day(-3), deliverable: "SSO Setup storyboard" },
      ],
    },
    {
      name: "New Customer Onboarding Series", methodology: "ADDIE", status: "active",
      description: "Device Management Fundamentals and related onboarding content for newly-signed customers.",
      phases: [
        { name: "Analyze", status: "done", start: day(-25), end: day(-16) },
        { name: "Design", status: "in_progress", start: day(-15) },
        { name: "Develop", status: "not_started" },
        { name: "Implement", status: "not_started" },
        { name: "Evaluate", status: "not_started" },
      ],
      deliverables: [
        { name: "Device Management storyboard", type: "storyboard", status: "in_progress", phase: "Design", storyboardId: sb.devices,
          reviews: [
            { by: "riley", round: 1, status: "requested", due: day(9) },
            { by: "admin", round: 1, status: "in_review", due: day(2) },
          ] },
        { name: "Facilitator deck", type: "document", status: "not_started", phase: "Develop" },
      ],
      milestones: [{ name: "Content lock", due: day(14) }, { name: "Cohort 1 delivery", due: day(52) }],
      time: [{ by: "sam", minutes: 190, note: "Device enrollment storyboard", for: day(-2), deliverable: "Device Management storyboard" }],
    },
    {
      name: "Partner Enablement Curriculum", methodology: "CUSTOM", status: "on_hold",
      description: "Blended curriculum for MSP partners. On hold pending 2026 partner-program budget approval.",
      phases: [
        { name: "Discovery", status: "done", start: day(-40), end: day(-30) },
        { name: "Curriculum design", status: "in_progress", start: day(-29) },
      ],
      deliverables: [{ name: "Curriculum map", type: "document", status: "in_progress", phase: "Curriculum design" }],
      milestones: [{ name: "Budget approval", due: day(18) }, { name: "Cohort 1 start", due: day(45) }],
      time: [{ by: "riley", minutes: 120, note: "Partner competency framework research", for: day(-35) }],
    },
    {
      name: "2025 Platform Update Training", methodology: "ADDIE", status: "completed",
      description: "Last year's platform-update rollout training. Delivered on time; archived for reference.",
      phases: [
        { name: "Analyze", status: "done", start: day(-320), end: day(-305) },
        { name: "Design", status: "done", start: day(-304), end: day(-280) },
        { name: "Develop", status: "done", start: day(-279), end: day(-250) },
        { name: "Implement", status: "done", start: day(-249), end: day(-235) },
        { name: "Evaluate", status: "done", start: day(-234), end: day(-220) },
      ],
      deliverables: [
        { name: "Platform update course suite", type: "other", status: "complete", phase: "Develop",
          reviews: [{ by: "devon", round: 2, status: "approved", due: day(-260), feedback: "All new features covered accurately. Approved." }] },
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
              requestedById: U[r.by === "admin" ? "riley" : "admin"],
              round: r.round, status: r.status, dueDate: r.due, feedback: r.feedback,
            })),
          } : undefined,
        },
      });
      delivIdByName[d.name] = deliverable.id;
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
  return projects.map((p) => p.name);
}

// ── whiteboards ──────────────────────────────────────────────────────────────
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
function boxWithLabel(x: number, y: number, w: number, h: number, label: string, extra: Ex = {}): Ex[] {
  return [rectEl(x, y, w, h, extra), textEl(x + 12, y + h / 2 - 10, label, 16)];
}

async function seedWhiteboards(workspaceId: string, ownerId: string) {
  const MARKER = "Customer Onboarding — Flow";
  const existing = await prisma.whiteboard.findFirst({ where: { workspaceId, title: MARKER } });
  if (existing) return;

  const tourSb = await prisma.storyboard.findFirst({
    where: { workspaceId, title: "Welcome to JumpCloud: Admin Console Tour" },
    select: { id: true },
  });

  const flow: Ex[] = [
    textEl(220, 40, "Customer Onboarding Flow", 28),
    ...boxWithLabel(240, 100, 220, 64, "Contract signed"),
    arrowEl(350, 168, 0, 44),
    ...boxWithLabel(240, 216, 220, 64, "Day 1 · Console tour"),
    arrowEl(350, 284, 0, 44),
    ...boxWithLabel(240, 332, 220, 64, "Week 1 · Core setup"),
    arrowEl(350, 400, 0, 44),
    ...boxWithLabel(240, 448, 220, 64, "30 / 60 / 90 check-ins"),
    arrowEl(460, 480, 120, 0),
    ...boxWithLabel(600, 448, 200, 64, "CSM sign-off", { strokeColor: "#2f9e44" }),
  ];

  const wireframe: Ex[] = [
    textEl(120, 40, "Course Player — Wireframe", 24),
    rectEl(120, 90, 560, 360),
    ...boxWithLabel(120, 90, 560, 48, "Course title  ·  progress"),
    ...boxWithLabel(120, 138, 150, 312, "Menu"),
    ...boxWithLabel(270, 138, 410, 250, "Lesson content"),
    ...boxWithLabel(560, 398, 120, 44, "Next →", { backgroundColor: "#a5d8ff" }),
  ];

  const brainstorm: Ex[] = [
    textEl(140, 40, "Certification Exam Blueprint Ideas", 24),
    ...boxWithLabel(140, 100, 200, 100, "Scenario-based Qs", { backgroundColor: "#ffec99" }),
    ...boxWithLabel(370, 100, 200, 100, "Console drag & drop", { backgroundColor: "#b2f2bb" }),
    ...boxWithLabel(140, 230, 200, 100, "Troubleshooting sim", { backgroundColor: "#a5d8ff" }),
    ...boxWithLabel(370, 230, 200, 100, "Per-module checks", { backgroundColor: "#ffc9c9" }),
  ];

  await prisma.whiteboard.createMany({
    data: [
      { workspaceId, createdById: ownerId, storyboardId: tourSb?.id ?? null, title: MARKER, scene: excalidraw(flow) },
      { workspaceId, createdById: ownerId, title: "Course Player Wireframe", scene: excalidraw(wireframe) },
      { workspaceId, createdById: ownerId, title: "Certification Exam Blueprint — Brainstorm", scene: excalidraw(brainstorm) },
    ],
  });
  console.log("[demo] whiteboards: 3 (with example Excalidraw scenes)");
}

// ── intake requests ──────────────────────────────────────────────────────────
type IntakeSpec = {
  requesterName: string; requesterEmail: string; title: string; description: string;
  targetAudience?: string; targetDate?: Date; impact?: number; effort?: number;
  status: string; assignedTo?: string; rejectionReason?: string; convertToProject?: string;
};

async function seedIntake(workspaceId: string, U: Record<string, string>) {
  const specs: IntakeSpec[] = [
    {
      requesterName: "Jamie Chen", requesterEmail: "jamie.chen@acme-corp.example",
      title: "Training on new Conditional Access policies",
      description: "Our admins keep asking Support how the new Conditional Access policy builder works. Could Customer Education put together a short course or video?",
      targetAudience: "Existing customer admins", targetDate: day(30),
      status: "submitted",
    },
    {
      requesterName: "Morgan Lee", requesterEmail: "morgan.lee@globex.example",
      title: "Device compliance certification track",
      description: "We'd love a formal certification path for our IT team specifically around device compliance policies — something we can point auditors to.",
      targetAudience: "Enterprise IT admins", targetDate: day(60),
      impact: 5, effort: 3, status: "triaging", assignedTo: "priya",
    },
    {
      requesterName: "Alex Rivera", requesterEmail: "alex.rivera@initech.example",
      title: "Video walkthrough for RADIUS setup",
      description: "RADIUS setup keeps generating support tickets. A short video walkthrough would probably cut ticket volume a lot.",
      targetAudience: "Network admins", impact: 3, effort: 2, status: "triaging", assignedTo: "jordan",
    },
    {
      requesterName: "Taylor Brooks", requesterEmail: "taylor.brooks@partner-msp.example",
      title: "Onboarding deck for MSP partners",
      description: "As we bring on more MSP partners we need a standard onboarding deck they can use with their own customers.",
      targetAudience: "MSP partners", targetDate: day(45),
      status: "submitted",
    },
    {
      requesterName: "Casey Novak", requesterEmail: "casey.novak@umbrella.example",
      title: "Quick reference card for Password Manager rollout",
      description: "Rolling out Password Manager to 400 employees next month — need a one-page quick reference our helpdesk can hand out.",
      targetAudience: "End users", impact: 4, effort: 2, status: "converted",
      convertToProject: "New Customer Onboarding Series",
    },
    {
      requesterName: "Nadia Kowalski", requesterEmail: "nadia.kowalski@eu-client.example",
      title: "Localization request for EU customers — FR/DE",
      description: "Several of our EU customers have asked whether the onboarding courses are available in French or German.",
      targetAudience: "EU customers", impact: 2, effort: 5, status: "rejected",
      rejectionReason: "Localization is on the 2026 roadmap but out of scope for this cycle — revisiting in Q1.",
    },
  ];

  let number = 0;
  for (const s of specs) {
    number += 1;
    const convertedProjectId = s.convertToProject
      ? (await prisma.project.findFirst({ where: { workspaceId, name: s.convertToProject }, select: { id: true } }))?.id
      : undefined;
    await prisma.intakeRequest.create({
      data: {
        workspaceId, number,
        requesterName: s.requesterName, requesterEmail: s.requesterEmail,
        title: s.title, description: s.description,
        targetAudience: s.targetAudience, targetDate: s.targetDate,
        impactScore: s.impact, effortScore: s.effort,
        status: s.status, assignedToId: s.assignedTo ? U[s.assignedTo] : undefined,
        rejectionReason: s.rejectionReason, convertedProjectId,
      },
    });
  }
  console.log(`[demo] intake requests: ${specs.length} (spanning submitted/triaging/converted/rejected)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("[demo] failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
