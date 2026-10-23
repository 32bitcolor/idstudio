import Link from "next/link";
import { Lead, H2, P, UL, LI, Steps, Callout, DefList, Def, UI, Screenshot } from "@/components/help/prose";

export default function MyWork() {
  return (
    <>
      <Lead>
        <strong>My Work</strong> is your personal hub — everything across the workspace that&rsquo;s
        waiting on you, in one place. It answers two questions at a glance: what needs my attention,
        and what am I still waiting on from other people? It also keeps the history of reviews
        you&rsquo;ve finished.
      </Lead>

      <Callout tone="note">
        My Work never invents work. Everything here comes from reviews, cards, subtasks, and milestones
        you&rsquo;re already attached to — so an empty page genuinely means you&rsquo;re caught up.
      </Callout>

      <H2>The Overview tab</H2>
      <Screenshot name="my-work" alt="My Work's Overview tab, with reviews awaiting you, reviews you're waiting on, and your assigned cards" caption="My Work: what needs you, and what you're waiting on." />
      <P>
        Open My Work from the sidebar (or the bell in the header) and you land on <UI>Overview</UI>.
        Each section shows a live count, with the most actionable work at the top:
      </P>
      <DefList>
        <Def term="Awaiting my review">
          Review rounds where you&rsquo;re a reviewer and haven&rsquo;t decided yet. You can open the
          review or decide right here (see below).
        </Def>
        <Def term="I'm waiting on">
          Open reviews <em>you</em> started: who&rsquo;s still reviewing, and when it&rsquo;s due.
        </Def>
        <Def term="My intake requests">
          Open intake requests assigned to you, with their status and needed-by date. Shown only when you
          have some.
        </Def>
        <Def term="My action items">Board cards assigned to you, with their board, column, and due date.</Def>
        <Def term="My subtasks">Open subtasks assigned to you, with the card they belong to.</Def>
        <Def term="Upcoming milestones">The next project milestones coming due, soonest first.</Def>
        <Def term="My whiteboards">Canvases you created, for quick jump-back-in access.</Def>
      </DefList>
      <P>
        The second tab, <UI>Review History</UI>, holds the reviews that are already decided. More on
        that below.
      </P>

      <H2>Reviewing something</H2>
      <P>
        When someone asks you to review a deliverable, it appears under <UI>Awaiting my review</UI>{" "}
        (and you&rsquo;re emailed a link). Each entry names the deliverable, the project, who asked,
        the round number, and the due date.
      </P>
      <Steps>
        <>
          Choose <UI>Open review</UI> to see exactly what was sent: the storyboard as it was when the
          round started, or the uploaded PDF or image. Comment there on specific text, screens, or
          pages.
        </>
        <>
          Add an overall note in <UI>Add review feedback (shared with the requester)…</UI> if you like.
        </>
        <>
          Decide: <UI>Approve</UI>, <UI>Approve with minor changes</UI>, or <UI>Request changes</UI>.
          You can decide on the review page or right here in My Work.
        </>
      </Steps>
      <UL>
        <LI>
          <UI>Mark in review</UI> tells the requester you&rsquo;ve started; the review stays in your
          queue.
        </LI>
        <LI>
          <UI>Save note</UI> stores your overall note without deciding.
        </LI>
      </UL>
      <P>
        A round passes when every reviewer approves (with or without minor changes). If anyone
        requests changes, the requester revises and starts the next round, which comes back to you.
      </P>

      <H2>Asking for a review</H2>
      <P>
        Reviews start on a project deliverable, not in My Work: open the project and choose{" "}
        <UI>Request a review</UI> on the deliverable. The{" "}
        <Link href="/help/projects" className="font-medium text-accent underline underline-offset-2">
          Projects guide
        </Link>{" "}
        covers rounds, guest reviewers, and turning feedback into cards. Once it&rsquo;s started, follow
        it under <UI>I&rsquo;m waiting on</UI>.
      </P>

      <H2>Where a review stands</H2>
      <DefList>
        <Def term="Requested">Waiting for the reviewer to start.</Def>
        <Def term="In review">The reviewer has picked it up.</Def>
        <Def term="Approved">Signed off.</Def>
        <Def term="Approved with minor changes">Signed off, with small fixes to make. Counts as approval.</Def>
        <Def term="Changes requested">Sent back. The next round starts when the requester is ready.</Def>
      </DefList>
      <P>
        <UI>Requested</UI> and <UI>In review</UI> are open and show on the Overview tab; the other three
        are decided and move to Review History.
      </P>

      <H2>Review History &amp; undo</H2>
      <P>
        <UI>Review History</UI> is a running record of decided reviews, both ones you reviewed and ones
        you requested: the deliverable, project, round, outcome, and the date, with the overall note
        underneath.
      </P>
      <P>
        Decided too soon? Each row has <UI>Undo approval</UI> (for an approval) or <UI>Reopen</UI> (for
        changes requested). Either puts the review back to <UI>In review</UI> and back in the
        reviewer&rsquo;s queue.
      </P>
      <Callout tone="warning">
        Undo reopens the same round rather than starting a new one, so the earlier decision is
        replaced. For a clean record of a second pass, start the next round on the deliverable instead.
      </Callout>
    </>
  );
}
