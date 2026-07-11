import Link from "next/link";
import { Lead, H2, P, UL, LI, Steps, Callout, UI } from "@/components/help/prose";

export default function GettingStarted() {
  return (
    <>
      <Lead>
        IDStudio is the workspace that runs your whole instructional-design process in one place —
        intake, planning, design, SME review, and delivery — sitting above the authoring tools and
        LMS you already use. This guide gets you oriented in a couple of minutes.
      </Lead>

      <H2>Your workspace</H2>
      <P>
        Everything in IDStudio lives inside a <strong>workspace</strong> — your team&rsquo;s shared
        home for boards, projects, storyboards, and whiteboards. Everyone you invite becomes a member
        of the workspace, with one of two roles:
      </P>
      <UL>
        <LI>
          <strong>Admin</strong> — manages members, groups, and access, in addition to doing the
          regular work.
        </LI>
        <LI>
          <strong>Member</strong> — does the day-to-day work: boards, projects, storyboards, reviews.
        </LI>
      </UL>

      <H2>Finding your way around</H2>
      <P>The app has one consistent shell, so every screen feels the same:</P>
      <UL>
        <LI>
          The <strong>left sidebar</strong> lists your modules — My Work, Boards, Projects,
          Storyboards, Whiteboards. Collapse it with the toggle in the header when you want more room.
        </LI>
        <LI>
          The <strong>breadcrumbs</strong> at the top show where you are and let you jump back up a
          level.
        </LI>
        <LI>
          The <strong>Dashboard</strong> (the IDStudio logo, top-left) is your at-a-glance home:
          active projects, what&rsquo;s awaiting your review, and upcoming milestones.
        </LI>
      </UL>

      <H2>A good first run</H2>
      <Steps>
        <>
          Open <strong>Settings → Account</strong> and change your password from whatever you were
          given.
        </>
        <>
          If you&rsquo;re an admin, head to <strong>Settings → Members &amp; groups</strong> and add
          your team.
        </>
        <>
          Create your first <strong>Project</strong>, pick a methodology (
          <Link href="/help/addie-sam" className="font-medium text-accent underline underline-offset-2">
            ADDIE or SAM
          </Link>
          ), and let IDStudio seed the phases.
        </>
        <>
          Spin up a <strong>Board</strong> for your production pipeline and start turning the plan
          into tracked, assignable work.
        </>
      </Steps>

      <H2>Make it yours</H2>
      <P>
        Head to <UI>Settings → Account → Appearance</UI> to switch between 17 built-in themes — from
        clean Light and GitHub to Dracula, Rosé Pine, Everforest, and more. Your choice is remembered
        on this device and applies instantly across the whole app.
      </P>

      <Callout tone="tip">
        New to instructional-design process? Start with the{" "}
        <Link href="/help/addie-sam" className="font-medium text-accent underline underline-offset-2">
          ADDIE &amp; SAM explainer
        </Link>{" "}
        — it&rsquo;s the backbone of how Projects work here. Then skim the module guides in the
        sidebar for the features you&rsquo;ll use most.
      </Callout>
    </>
  );
}
