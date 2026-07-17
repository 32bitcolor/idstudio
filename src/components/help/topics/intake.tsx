import { Lead, H2, H3, P, UL, LI, Steps, Callout, DefList, Def, UI } from "@/components/help/prose";

export default function Intake() {
  return (
    <>
      <Lead>
        <strong>Intake</strong> is the front door for training and content requests. Instead of L&amp;D
        catching asks over email, chat, and hallway conversations, every request comes in one way,
        gets triaged and scored, and either becomes a project or a documented no &mdash; so your team
        leads the work rather than reacting to whoever shouted loudest.
      </Lead>

      <H2>The public intake link</H2>
      <P>
        Every workspace has a public submission form at its own link &mdash; something like{" "}
        <UI>/request/your-workspace</UI>. Anyone with the link can submit a request; there&rsquo;s{" "}
        <strong>no login required</strong>, which is the point &mdash; stakeholders shouldn&rsquo;t
        need an account to ask for help. Requests they submit land in <UI>Intake</UI> for your team
        to triage.
      </P>

      <Steps>
        <>
          As a workspace admin, open <UI>Settings → Intake</UI>. You&rsquo;ll see the{" "}
          <UI>Public intake link</UI> panel with your shareable URL.
        </>
        <>
          Click <UI>Copy</UI> to grab the link, then share it however stakeholders reach you &mdash;
          an email signature, a team wiki, an internal portal, a Slack channel topic.
        </>
        <>
          Use <UI>Enable intake form</UI> / <UI>Disable intake form</UI> to control whether the form
          accepts requests. While disabled, the link shows a not-found page, so you can pause intake
          without breaking anything you&rsquo;ve already shared.
        </>
      </Steps>

      <P>
        On the form, the requester fills in <UI>Your name</UI> and <UI>Your email</UI>,{" "}
        <UI>What do you need?</UI> (a short title), and <UI>Tell us more</UI> (the full description).
        Two optional fields help you triage: <UI>Audience</UI> and <UI>Needed by</UI>. On submit they
        get a confirmation screen with a reference number like <UI>REQ-14</UI>.
      </P>

      <Callout tone="note" title="Spam protection">
        The form has a hidden honeypot field that real people never see &mdash; if it&rsquo;s filled
        in, the submission is silently dropped. There&rsquo;s also a per-network rate limit, so a bot
        (or an over-eager tab) can&rsquo;t flood your queue.
      </Callout>

      <H2>The triage queue</H2>
      <P>
        Everything that comes in appears on the <UI>Intake</UI> page in the sidebar. The queue sorts
        itself so the work that needs attention floats up: untriaged requests come first, then
        everything you&rsquo;ve scored, ordered by priority &mdash; highest first. Each row shows the
        reference number, current status, an impact/effort quadrant once scored, and the{" "}
        <UI>Needed by</UI> date (highlighted when it&rsquo;s close or past).
      </P>
      <P>
        Click a request&rsquo;s title to open its full detail page, where you&rsquo;ll find the whole
        description, the audience, the requester&rsquo;s contact info, and the same triage controls
        with room to reject.
      </P>

      <H2>Scoring and assigning</H2>
      <P>
        Triage is two quick decisions per request: how much it matters and what it&rsquo;ll take. You
        can do both right on the queue row, or on the detail page.
      </P>

      <DefList>
        <Def term="Impact">
          Rate the value of doing this work from <strong>1 to 5</strong>. Higher means it moves the
          needle more &mdash; more learners reached, bigger risk retired, clearer business outcome.
        </Def>
        <Def term="Effort">
          Rate the cost to deliver it from <strong>1 to 5</strong>. Higher means more work &mdash;
          more content to build, more stakeholders to wrangle, more unknowns.
        </Def>
        <Def term="Assigned to">
          Hand the request to a workspace member with the <UI>Assign to</UI> dropdown, or leave it{" "}
          <UI>Unassigned</UI>. Assigning gives it an owner while it&rsquo;s still just a request.
        </Def>
      </DefList>

      <P>
        The moment a request has both scores, IDStudio derives its priority and an impact/effort{" "}
        <em>quadrant</em> badge &mdash; a <em>Quick win</em> (high impact, low effort), a{" "}
        <em>Big bet</em> (high impact, high effort), a <em>Fill-in</em>, or a <em>Reconsider</em>{" "}
        &mdash; so you can see at a glance what deserves your team&rsquo;s time. Scoring an untriaged
        request also moves it from <UI>Submitted</UI> to <UI>Triaging</UI> automatically.
      </P>

      <Callout tone="tip">
        You don&rsquo;t have to score everything before doing anything. The queue keeps unscored
        requests up top precisely so triage is the fast first pass &mdash; skim, score, and let the
        priority order tell you what to open next.
      </Callout>

      <H2>The request lifecycle</H2>
      <P>
        A request moves through a small, honest set of statuses. Every one is visible on the request,
        so nobody has to wonder where their ask went.
      </P>

      <DefList>
        <Def term="Submitted">
          Fresh in from the public form and not yet touched. These sit at the top of the queue.
        </Def>
        <Def term="Triaging">
          You&rsquo;ve started scoring it. A working state &mdash; it has an impact and effort read
          but no final decision.
        </Def>
        <Def term="Converted">
          Approved and turned into a real project. The request links straight to it.
        </Def>
        <Def term="Rejected">
          Declined, with a reason captured for the record and for the requester.
        </Def>
      </DefList>

      <H2>Approving and rejecting</H2>
      <P>
        When a request is worth doing, use <UI>Approve &amp; create project</UI>. IDStudio spins up a
        new <strong>ADDIE</strong> project from the request&rsquo;s title, marks the request as{" "}
        <UI>Converted</UI>, and links the two so you can jump between them. You&rsquo;ll be dropped
        straight onto the new project to start planning. (Approving asks you to confirm first, since
        it creates real work.)
      </P>
      <P>
        When a request isn&rsquo;t a fit, click <UI>Reject</UI>, add a short reason (optional, but
        kind), and <UI>Confirm reject</UI>. The reason is saved on the request so the decision
        stays transparent later. Approving or rejecting is final &mdash; a resolved request drops its
        triage controls.
      </P>

      <Callout tone="note" title="Emails go out automatically">
        The requester always gets a confirmation email the moment they submit, and a decision email
        when you approve or reject &mdash; those are transactional and can&rsquo;t be switched off.
        Workspace admins can also get a heads-up email on each new request; that one respects the{" "}
        <UI>Intake</UI> toggle in <UI>Settings → Notifications</UI>. See the Notifications article for
        the full picture.
      </Callout>

      <H3>How Intake fits</H3>
      <P>
        Intake is the first pillar of the IDStudio roadmap and the top of the funnel: it&rsquo;s where
        demand enters, gets weighed, and turns into committed work. Approved requests flow directly
        into <em>Projects</em>, where the ADDIE methodology carries them from analysis through
        evaluation. Think of Intake as deciding <em>whether</em> and <em>what</em>, and Projects as
        running the <em>how</em>.
      </P>
    </>
  );
}
