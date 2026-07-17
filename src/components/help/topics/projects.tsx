import Link from "next/link";
import { Lead, H2, H3, P, UL, LI, Steps, Callout, DefList, Def, UI } from "@/components/help/prose";

export default function Projects() {
  return (
    <>
      <Lead>
        <strong>Projects</strong> are the instructional-design planning heart of IDStudio. A project
        holds the whole shape of a build: the methodology and its phases, the deliverables you owe,
        the SME and stakeholder reviews they go through, your milestones, and the time logged against
        it all — one place to answer &ldquo;where is this, and what&rsquo;s left?&rdquo;
      </Lead>

      <H2>Create a project and pick a methodology</H2>
      <P>
        Projects live under <UI>Projects</UI> in the sidebar. When you create one you choose a{" "}
        <strong>methodology</strong>, and IDStudio seeds the matching phases so you start with real
        structure instead of a blank page.
      </P>

      <Steps>
        <>
          On the <UI>Projects</UI> page, enter a name in <UI>New project name…</UI>.
        </>
        <>
          Choose <UI>ADDIE</UI>, <UI>SAM</UI>, or <UI>Custom (start empty)</UI> from the methodology
          dropdown, then click <UI>Create project</UI>.
        </>
        <>
          Open the project to set its overall <UI>Status</UI> (<UI>Active</UI>, <UI>On hold</UI>, or{" "}
          <UI>Completed</UI>) and add a description.
        </>
      </Steps>

      <P>
        Not sure which methodology fits? See{" "}
        <Link href="/help/addie-sam" className="underline underline-offset-2">
          ADDIE vs. SAM
        </Link>{" "}
        for what each is and when to reach for it. ADDIE seeds five phases, SAM seeds three, and
        Custom starts empty for you to build your own.
      </P>

      <H2>Phases</H2>
      <P>
        Phases are the stages your project moves through. Each one carries a status and optional
        start/end dates, and the project card in the grid shows a live <em>done / total</em> progress
        bar built from them.
      </P>
      <UL>
        <LI>
          <strong>Advance the status</strong> — click a phase&rsquo;s status badge to cycle it{" "}
          <UI>Not started</UI> → <UI>In progress</UI> → <UI>Done</UI>.
        </LI>
        <LI>
          <strong>Set dates</strong> — fill in <UI>Start</UI> and <UI>End</UI> to plan the timeline.
        </LI>
        <LI>
          <strong>Reorder or edit</strong> — use the <UI>↑</UI> / <UI>↓</UI> arrows to move a phase,
          click its name to rename it, and <UI>×</UI> to delete it. Add more with{" "}
          <UI>+ Add a phase</UI>.
        </LI>
      </UL>

      <Callout tone="note">
        The seeded phases are a starting point, not a cage. Add, rename, reorder, or remove them
        freely so the pipeline matches how this particular project actually runs.
      </Callout>

      <H2>Deliverables</H2>
      <P>
        Deliverables are the things you&rsquo;re actually producing — a storyboard, an assessment, a job
        aid. Add one with <UI>+ Add a deliverable</UI>, then set its type, status, and phase, and
        optionally connect it to the work happening elsewhere in the app.
      </P>

      <H3>Type</H3>
      <P>
        Pick what the deliverable is: <UI>Storyboard</UI>, <UI>Assessment</UI>,{" "}
        <UI>Job aid</UI>, <UI>Video</UI>, <UI>Document</UI>, or <UI>Other</UI>. When the type is{" "}
        <UI>Storyboard</UI>, a <UI>Create storyboard</UI> button appears — one click spins up a linked
        storyboard (and <UI>Open storyboard</UI> jumps to it thereafter).
      </P>

      <H3>Status</H3>
      <DefList>
        <Def term="Not started">Queued — no work begun yet.</Def>
        <Def term="In progress">Actively being built.</Def>
        <Def term="In review">Out with a SME or stakeholder for feedback.</Def>
        <Def term="Complete">Done and approved.</Def>
      </DefList>

      <H3>Link to a board card</H3>
      <P>
        Use the <UI>Link a card…</UI> dropdown to tie a deliverable to a specific board card, so the
        plan and the day-to-day execution point at the same work. Once linked, the card title shows as
        a chip you can follow straight to its board; the <UI>×</UI> unlinks it.
      </P>

      <H2>Review cycles</H2>
      <P>
        Every deliverable has its own <strong>reviews</strong> — the SME and stakeholder sign-off loop
        that&rsquo;s the daily bottleneck for most ID teams. Expand <UI>Reviews</UI> on a deliverable
        to see and manage its rounds.
      </P>

      <Steps>
        <>
          Click <UI>+ Request a review</UI>, choose a reviewer from your workspace members, optionally
          set a due date, and click <UI>Request review</UI>. This opens <strong>Round 1</strong> and
          emails the reviewer a link to it.
        </>
        <>
          The reviewer acts on it — an approve / request-changes decision they&rsquo;ll find in{" "}
          <strong>My Work</strong>. Each round tracks a status: <UI>Requested</UI>, <UI>In review</UI>,{" "}
          <UI>Changes requested</UI>, or <UI>Approved</UI>.
        </>
        <>
          Feedback lives on the round itself. Request another review to open the next round — rounds
          are numbered, so the full revision history stays visible.
        </>
      </Steps>

      <Callout tone="tip">
        The collapsed <UI>Reviews</UI> line shows the latest round&rsquo;s status at a glance, so you
        can scan a project and immediately see what&rsquo;s still waiting on a SME.
      </Callout>

      <H2>Milestones and time tracking</H2>
      <P>
        <strong>Milestones</strong> are the dated checkpoints that matter — a kickoff, a pilot, a
        go-live. Add one with <UI>+ Add a milestone</UI>, give it a due date, and check it off when
        it&rsquo;s hit; overdue, uncompleted milestones show their date in red. Upcoming milestones
        also surface on your home dashboard and in My Work.
      </P>
      <P>
        <strong>Time tracking</strong> records effort against the project. Click <UI>+ Log time</UI>,
        enter the date and hours, optionally attribute it to a deliverable and add a note, then click{" "}
        <UI>Log</UI>. The section header keeps a running total of hours logged across the whole
        project.
      </P>

      <H2>Sprint planning</H2>
      <P>
        A project can opt into <strong>sprints</strong> — time-boxed iterations the team runs on a
        shared board. Turn on <UI>Sprint planning</UI> on the project to make its board cards
        assignable to a sprint; from there they show up on the team sprint board grouped by status.
        See the{" "}
        <Link href="/help/sprints" className="underline underline-offset-2">
          Sprints
        </Link>{" "}
        guide for how sprints work end to end.
      </P>

      <Callout tone="note" title="Access">
        Projects are visible to all workspace members by default. An admin can restrict a project to
        specific groups from the workspace group settings; once restricted, only those groups (and
        admins) can see it in the list, on the dashboard, or via a direct link.
      </Callout>
    </>
  );
}
