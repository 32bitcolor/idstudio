import { Lead, H2, H3, P, UL, LI, Steps, Callout, DefList, Def, UI } from "@/components/help/prose";

export default function AddieSam() {
  return (
    <>
      <Lead>
        Every IDStudio project runs on a <strong>methodology</strong> — the process you follow to
        take a request from idea to launched learning. IDStudio ships with the two most common ones,
        ADDIE and SAM, plus a Custom option. Here&rsquo;s what each is, when to reach for it, and how
        it shows up in the app.
      </Lead>

      <Callout tone="note">
        A methodology is just a shared map of the work — it doesn&rsquo;t replace your judgment. Pick
        the one that matches how your team actually operates, and adapt the phases as you go.
      </Callout>

      <H2>ADDIE — the structured backbone</H2>
      <P>
        ADDIE is the classic instructional-design framework: five sequential phases that carry a
        course from analysis through evaluation. It&rsquo;s deliberate and thorough, which makes it a
        strong fit for high-stakes or compliance content where requirements are known up front and
        sign-off matters at each step.
      </P>

      <DefList>
        <Def term="Analyze">
          Define the problem before designing a thing. Who are the learners, what&rsquo;s the
          performance gap, what are the constraints, and what business outcome is this supposed to
          move? The output is a clear set of learning objectives.
        </Def>
        <Def term="Design">
          Turn objectives into a plan: the structure, sequence, assessment strategy, and look and
          feel. This is where storyboards and prototypes take shape — the blueprint, not the build.
        </Def>
        <Def term="Develop">
          Build the actual assets — courses, videos, job aids, assessments — from the approved
          design. Draft, review, revise, repeat until the deliverables are production-ready.
        </Def>
        <Def term="Implement">
          Ship it. Publish to the LMS, run the pilot, train facilitators, and roll out to learners.
        </Def>
        <Def term="Evaluate">
          Measure whether it worked — reactions, learning, behavior change, and business impact — and
          feed what you learn back into the next iteration.
        </Def>
      </DefList>

      <H3>Reach for ADDIE when</H3>
      <UL>
        <LI>Requirements are well understood and unlikely to shift mid-project.</LI>
        <LI>The content is compliance, regulatory, or otherwise high-stakes and needs an audit trail.</LI>
        <LI>Multiple stakeholders need formal sign-off at defined checkpoints.</LI>
        <LI>You&rsquo;re coordinating a larger team and want clear, phase-based hand-offs.</LI>
      </UL>

      <H2>SAM — the iterative alternative</H2>
      <P>
        SAM (the Successive Approximation Model) trades ADDIE&rsquo;s long linear march for tight,
        repeating cycles. Instead of perfecting each phase before moving on, you build small,
        get feedback fast, and refine — converging on a good product through successive passes. It
        shines when the problem is fuzzy, speed matters, or stakeholders need to see something
        tangible before they can tell you what they want.
      </P>

      <DefList>
        <Def term="Preparation">
          A quick information-gathering and alignment kickoff (often a &ldquo;Savvy Start&rdquo;
          brainstorm) to rally the team and background the problem — measured in days, not weeks.
        </Def>
        <Def term="Iterative Design">
          Rapid rounds of design → prototype → review. Each loop sharpens the concept with real
          stakeholder feedback before anything expensive gets built.
        </Def>
        <Def term="Iterative Development">
          Build in the same looping rhythm — alpha, beta, gold — reviewing and correcting each
          release rather than saving all the feedback for the end.
        </Def>
      </DefList>

      <H3>Reach for SAM when</H3>
      <UL>
        <LI>The requirements are unclear and will emerge as people react to prototypes.</LI>
        <LI>Speed and early momentum matter more than an exhaustive up-front plan.</LI>
        <LI>Your SMEs and stakeholders engage best with something concrete in front of them.</LI>
        <LI>You expect to revise heavily and want feedback baked into every step.</LI>
      </UL>

      <H2>ADDIE vs. SAM at a glance</H2>
      <DefList>
        <Def term="Flow">ADDIE is linear and sequential; SAM is cyclical and iterative.</Def>
        <Def term="Feedback">ADDIE gathers it at phase gates; SAM gathers it every loop.</Def>
        <Def term="Best for">ADDIE for stable, high-stakes work; SAM for fast-moving, evolving work.</Def>
        <Def term="Risk">ADDIE surfaces problems late; SAM surfaces them early, cheaply.</Def>
      </DefList>

      <H2>How methodology works in IDStudio</H2>
      <P>
        When you create a project, you choose ADDIE, SAM, or Custom. IDStudio seeds the matching
        phases so you start with a real structure instead of a blank page:
      </P>
      <DefList>
        <Def term="ADDIE">Analyze · Design · Develop · Implement · Evaluate</Def>
        <Def term="SAM">Preparation · Iterative Design · Iterative Development</Def>
        <Def term="Custom">Starts empty — build your own pipeline phase by phase.</Def>
      </DefList>

      <Steps>
        <>Create a project and pick a methodology — the phases appear automatically.</>
        <>
          Work the phases: set each to <UI>Not started</UI>, <UI>In progress</UI>, or{" "}
          <UI>Done</UI>, and give them start/end dates. Add, reorder, or remove phases anytime —
          the methodology is a starting point, not a cage.
        </>
        <>
          Hang deliverables (courses, storyboards, assessments) off the project, route them through
          SME review cycles, and track milestones and time against the same plan.
        </>
      </Steps>

      <Callout tone="tip">
        Not sure which to use? Default to <strong>SAM</strong> when you&rsquo;re still figuring out
        what the learning should even be, and <strong>ADDIE</strong> once the requirements are locked
        and sign-off is the name of the game. You can always add phases to either.
      </Callout>
    </>
  );
}
