<!-- Generated from src/components/help by `npm run help:export`. Edit the app's help, not this file. -->

# Intake

> **Intake** is the front door for training and content requests. Instead of L&D catching asks over email, chat, and hallway conversations, every request comes in one way, gets triaged and scored, and either becomes a project or a documented no — so your team leads the work rather than reacting to whoever shouted loudest.

## The public intake link

Every workspace has a public submission form at its own link — something like **/request/your-workspace**. Anyone with the link can submit a request; there’s **no login required**, which is the point — stakeholders shouldn’t need an account to ask for help. Requests they submit land in **Intake** for your team to triage.

1. As a workspace admin, open **Settings → Intake**. You’ll see the **Public intake link** panel with your shareable URL.
2. Click **Copy** to grab the link, then share it however stakeholders reach you — an email signature, a team wiki, an internal portal, a Slack channel topic.
3. Use **Enable intake form** / **Disable intake form** to control whether the form accepts requests. While disabled, the link shows a not-found page, so you can pause intake without breaking anything you’ve already shared.

On the form, the requester fills in **Your name** and **Your email**, **What do you need?** (a short title), and **Tell us more** (the full description). Two optional fields help you triage: **Audience** and **Needed by**. On submit they get a confirmation screen with a reference number like **REQ-14**.

> **Spam protection.** The form has a hidden honeypot field that real people never see — if it’s filled in, the submission is silently dropped. Each network can also submit only five requests an hour, so a bot (or an over-eager tab) can’t flood your queue.

## The triage queue

Everything that comes in appears on the **Intake** page in the sidebar. The queue sorts itself so the work that needs attention floats up: untriaged requests come first, then everything you’ve scored, ordered by priority — highest first. Each row shows the reference number, current status, an impact/effort quadrant once scored, and the **Needed by** date (highlighted when it’s close or past).

Click a request’s title to open its full detail page, where you’ll find the whole description, the audience, the requester’s contact info, and the same triage controls with room to reject.

## Scoring and assigning

Triage is two quick decisions per request: how much it matters and what it’ll take. You can do both right on the queue row, or on the detail page.

**Impact** — Rate the value of doing this work from **1 to 5**. Higher means it moves the needle more — more learners reached, bigger risk retired, clearer business outcome.

**Effort** — Rate the cost to deliver it from **1 to 5**. Higher means more work — more content to build, more stakeholders to wrangle, more unknowns.

**Assigned to** — Hand the request to a workspace member with the **Assign to** dropdown, or leave it **Unassigned**. Assigning gives it an owner while it’s still just a request.

The moment a request has both scores, Tavoro derives its priority and an impact/effort *quadrant* badge — a *Quick win* (high impact, low effort), a *Big bet* (high impact, high effort), a *Fill-in*, or a *Reconsider* — so you can see at a glance what deserves your team’s time. Scoring an untriaged request also moves it from **Submitted** to **Triaging** automatically.

> **Tip.** You don’t have to score everything before doing anything. The queue keeps unscored requests up top precisely so triage is the fast first pass — skim, score, and let the priority order tell you what to open next.

## The request lifecycle

A request moves through a small, honest set of statuses. Every one is visible on the request, so nobody has to wonder where their ask went.

**Submitted** — Fresh in from the public form and not yet touched. These sit at the top of the queue.

**Triaging** — You’ve started scoring it. A working state — it has an impact and effort read but no final decision.

**Converted** — Approved and turned into a real project. The request links straight to it.

**Rejected** — Declined, with a reason captured for the record and for the requester.

## Approving and rejecting

When a request is worth doing, use **Approve & create project**. Tavoro spins up a new **ADDIE** project from the request’s title, marks the request as **Converted**, and links the two so you can jump between them. You’ll be dropped straight onto the new project to start planning. You can also choose **Approve** right on the queue row. (Approving asks you to confirm first, since it creates real work.)

When a request isn’t a fit, click **Reject**, add a short reason (optional, but kind), and **Confirm reject**. The reason is saved on the request so the decision stays transparent later. Approving or rejecting is final — a resolved request drops its triage controls.

> **Emails go out automatically.** The requester always gets a confirmation email the moment they submit, and a decision email when you approve or reject — those are transactional and can’t be switched off. Workspace admins can also get a heads-up email on each new request; that one respects the **Intake** toggle in **Settings → Notifications**. See the Notifications article for the full picture.

### How Intake fits

Intake is the top of the funnel: it’s where demand enters, gets weighed, and turns into committed work. Approved requests flow directly into *Projects*, where the ADDIE methodology carries them from analysis through evaluation. Think of Intake as deciding *whether* and *what*, and Projects as running the *how*.

---

← [Whiteboards](whiteboards.md) · [All guides](README.md) · [My Work & reviews](my-work.md) →
