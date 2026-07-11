import { Lead, H2, P, UL, LI, Steps, Callout, DefList, Def, UI } from "@/components/help/prose";

export default function MyWork() {
  return (
    <>
      <Lead>
        <strong>My Work</strong> is your personal hub — everything across the workspace that&rsquo;s
        waiting on you, in one place. It answers two questions at a glance: what needs my decision,
        and what am I still waiting on from other people? This guide covers both sides of a review —
        the reviewer&rsquo;s and the requester&rsquo;s — and where finished reviews go.
      </Lead>

      <Callout tone="note">
        My Work never invents work. Everything here is pulled from real reviews, board cards, and
        milestones you&rsquo;re already attached to — so an empty page genuinely means you&rsquo;re
        caught up.
      </Callout>

      <H2>The Overview tab</H2>
      <P>
        Open My Work from the sidebar and you land on <UI>Overview</UI>. It stacks five sections,
        each with a live count, so the most actionable work sits right at the top:
      </P>
      <DefList>
        <Def term="Awaiting my review">
          Reviews assigned to you that still need a decision. These are interactive — you can
          approve or request changes without leaving the page (see below).
        </Def>
        <Def term="I'm waiting on">
          Open reviews <em>you</em> requested from someone else. A quick read on what&rsquo;s still
          out for sign-off, who&rsquo;s holding it, and when it&rsquo;s due.
        </Def>
        <Def term="My action items">
          Board cards assigned to you, with their board, column, and due date — your production
          to-do list pulled straight off the Kanban.
        </Def>
        <Def term="Upcoming milestones">
          The next project milestones coming due across your workspace, soonest first.
        </Def>
        <Def term="My whiteboards">
          Canvases you created, for quick jump-back-in access.
        </Def>
      </DefList>
      <P>
        A second tab, <UI>Review History</UI>, holds every review that&rsquo;s already been resolved.
        More on that further down.
      </P>

      <H2>Reviewing something (the reviewer)</H2>
      <P>
        When a teammate asks you to review a deliverable, it shows up under{" "}
        <UI>Awaiting my review</UI> — no email digging required. Each card names the deliverable, the
        project, who requested it, the round number, and the due date. You act on it right there:
      </P>
      <Steps>
        <>
          Click the deliverable name to open the actual artifact (storyboard, board card, and so on)
          and take a look.
        </>
        <>
          Type your notes in the feedback box —{" "}
          <UI>Add review feedback (shared with the requester)</UI>. Whatever you write is visible to
          the person who requested the review, so it&rsquo;s the place for your rationale and any
          change requests.
        </>
        <>
          Decide. Hit <UI>Approve</UI> to sign off, or <UI>Request changes</UI> to send it back. Both
          save your feedback first, then remove the card from your queue.
        </>
      </Steps>
      <P>
        Two lighter-weight actions live alongside the decision buttons:
      </P>
      <UL>
        <LI>
          <UI>Mark in review</UI> — signals you&rsquo;ve picked it up and are actively working
          through it. The card stays in your queue and its status flips to <UI>In review</UI>.
        </LI>
        <LI>
          <UI>Save note</UI> — stores your feedback without making a decision, handy for parking a
          work-in-progress comment before you&rsquo;re ready to approve or send back.
        </LI>
      </UL>

      <Callout tone="tip">
        Requesting changes isn&rsquo;t a dead end — it&rsquo;s how the loop keeps turning. The
        requester sees your notes, revises, and typically opens a fresh review round, so each pass is
        tracked separately as <em>round 1</em>, <em>round 2</em>, and on.
      </Callout>

      <H2>Asking for a review (the requester)</H2>
      <P>
        Reviews start on a project deliverable, not in My Work. Open the project, find the
        deliverable, and expand its <UI>Reviews</UI> section:
      </P>
      <Steps>
        <>
          Click <UI>+ Request a review</UI>, pick a reviewer from the workspace members, and
          optionally set a due date.
        </>
        <>
          Hit <UI>Request review</UI>. That mints a new review round in the <UI>Requested</UI> state
          and drops it straight into the reviewer&rsquo;s <UI>Awaiting my review</UI> queue.
        </>
        <>
          Track it from My Work under <UI>I&rsquo;m waiting on</UI> — you&rsquo;ll see the current
          status and due date until the reviewer decides.
        </>
      </Steps>
      <P>
        On the deliverable itself you can also adjust the due date, edit feedback, change the status
        by hand, or delete a round entirely. When the reviewer approves or requests changes, the
        outcome flows back to your Review History automatically.
      </P>

      <H2>The review lifecycle</H2>
      <P>
        Every review round moves through four statuses. They&rsquo;re the shared vocabulary for where
        a piece of work stands:
      </P>
      <DefList>
        <Def term="Requested">
          The review has been created and is sitting in the reviewer&rsquo;s queue, not yet started.
        </Def>
        <Def term="In review">
          The reviewer has picked it up and is actively looking at it.
        </Def>
        <Def term="Changes requested">
          Sent back with feedback. The requester revises and usually opens a new round.
        </Def>
        <Def term="Approved">
          Signed off. The round is resolved and moves to Review History.
        </Def>
      </DefList>
      <P>
        <UI>Requested</UI> and <UI>In review</UI> are the &ldquo;open&rdquo; states you see on the
        Overview tab; <UI>Approved</UI> and <UI>Changes requested</UI> are &ldquo;resolved&rdquo; and
        live under Review History.
      </P>

      <H2>Review History &amp; undo</H2>
      <P>
        The <UI>Review History</UI> tab is a running record of resolved reviews — both ones you
        reviewed and ones you requested. Each row shows the deliverable, project, round number,
        outcome, and the date it was decided, with the reviewer&rsquo;s feedback quoted underneath.
      </P>
      <P>
        Made a decision too soon? Every history row has an undo control:
      </P>
      <UL>
        <LI>
          On an approved review, click <UI>Undo approval</UI> to walk it back.
        </LI>
        <LI>
          On a changes-requested review, click <UI>Reopen</UI>.
        </LI>
      </UL>
      <P>
        Either one sends the review back to <UI>In review</UI>, which returns it to the
        reviewer&rsquo;s <UI>Awaiting my review</UI> queue so the decision can be made again.
      </P>

      <Callout tone="warning">
        Undo reopens the same review round rather than creating a new one, so the prior outcome is
        replaced. If you instead want a clean record of a second pass — for example after the
        requester revises — request a fresh review on the deliverable to start the next round.
      </Callout>
    </>
  );
}
