import { Lead, H2, H3, P, UL, LI, Steps, Callout, DefList, Def, UI } from "@/components/help/prose";

export default function Storyboards() {
  return (
    <>
      <Lead>
        A <strong>storyboard</strong> is your screen-by-screen blueprint for a course — the plan a
        SME reviews and a developer builds from, before anyone opens an authoring tool. Each screen
        captures its type plus the on-screen text, narration, and the visual, interaction, and
        developer notes that spell out exactly what to build.
      </Lead>

      <H2>Create a storyboard</H2>
      <P>
        Storyboards live under <UI>Storyboards</UI> in the sidebar. You can create one on its own, or
        generate one already linked to a project deliverable (see below).
      </P>

      <Steps>
        <>
          On the <UI>Storyboards</UI> page, type a name into <UI>New storyboard title…</UI> and click{" "}
          <UI>Create storyboard</UI>.
        </>
        <>
          Open it, then set the <UI>Status</UI> — <UI>Draft</UI>, <UI>In review</UI>, or{" "}
          <UI>Approved</UI> — and add a description to frame the course.
        </>
        <>
          Build it out screen by screen (below). Rename the storyboard anytime by clicking its title.
        </>
      </Steps>

      <Callout tone="note">
        The storyboard <UI>Status</UI> tracks its overall state, and each card in the storyboards grid
        shows its status and screen count — a quick read on what&rsquo;s still in draft versus ready
        for a SME.
      </Callout>

      <H2>Screens</H2>
      <P>
        Screens are the ordered building blocks of the course. Add one with <UI>+ Add a screen</UI>,
        give it a title, and it appears at the end of the list, numbered in sequence. Click a
        screen&rsquo;s <UI>▸</UI> toggle to expand it and edit its fields; collapse it again to keep
        the outline scannable.
      </P>
      <UL>
        <LI>
          <strong>Rename</strong> — click the screen title to edit it inline.
        </LI>
        <LI>
          <strong>Reorder</strong> — use the <UI>↑</UI> / <UI>↓</UI> arrows to move a screen up or
          down; the numbering updates to match.
        </LI>
        <LI>
          <strong>Delete</strong> — the <UI>×</UI> removes a screen (you&rsquo;ll be asked to
          confirm).
        </LI>
      </UL>

      <H3>Screen type</H3>
      <P>
        The type dropdown on each screen labels its role in the course flow, so the whole sequence
        reads as a lesson at a glance:
      </P>
      <DefList>
        <Def term="Intro">Sets up the course or module — objectives, agenda, welcome.</Def>
        <Def term="Content">The core teaching screens carrying the substance.</Def>
        <Def term="Video">A video segment or demonstration.</Def>
        <Def term="Knowledge check">A quick, low-stakes check for understanding.</Def>
        <Def term="Interaction">A click-to-reveal, drag-and-drop, scenario, or other activity.</Def>
        <Def term="Assessment">A graded or formal check of mastery.</Def>
        <Def term="Summary">Wrap-up, recap, and next steps.</Def>
      </DefList>

      <H3>The per-screen fields</H3>
      <P>
        Expand a screen to find five rich-text fields — each supports bold, italic, an H2 heading, and
        bulleted or numbered lists, and saves automatically when you click out. Together they give a
        developer everything needed to build the screen:
      </P>
      <DefList>
        <Def term="On-screen text">Exactly what the learner will read on the screen.</Def>
        <Def term="Narration / VO">The voiceover or audio script for the screen.</Def>
        <Def term="Visual &amp; media notes">
          The imagery, graphics, layout, and media direction — what it should look like.
        </Def>
        <Def term="Interaction &amp; branching">
          How the learner interacts and where the course goes next — clicks, drags, branches, logic.
        </Def>
        <Def term="Developer notes">
          Build instructions for whoever assembles it in the authoring tool.
        </Def>
      </DefList>

      <Callout tone="tip">
        Keep <strong>On-screen text</strong> and <strong>Narration</strong> distinct — reviewers read
        them differently, and separating them makes SME feedback far cleaner than one blended
        &ldquo;script.&rdquo;
      </Callout>

      <H2>Linking a storyboard to a project</H2>
      <P>
        Storyboards are strongest when tied to the project they serve. On a project&rsquo;s{" "}
        <UI>Storyboard</UI>-type deliverable, click <UI>Create storyboard</UI> to generate one already
        linked to that deliverable; afterward the button reads <UI>Open storyboard</UI>. A linked
        storyboard shows its project and deliverable at the top of the page, and routes through that
        deliverable&rsquo;s SME review cycles.
      </P>
      <P>
        You can still create standalone storyboards from the <UI>Storyboards</UI> page for early
        exploration — they simply won&rsquo;t show a project link until you build one through a
        deliverable.
      </P>

      <H2>Whiteboards on a storyboard</H2>
      <P>
        Every storyboard has a <UI>Whiteboards</UI> section for the loose, visual thinking that
        precedes tidy screens — sketching a course flow, roughing out a wireframe, or mapping a
        branching scenario. Click <UI>New whiteboard</UI> to create an Excalidraw canvas linked to the
        storyboard; it appears as a card you can open anytime.
      </P>

      <Callout tone="note" title="Access">
        Storyboards are visible to all workspace members by default. An admin can restrict one to
        specific groups from the workspace group settings, and access is enforced everywhere — the
        list, the dashboard, and direct links alike.
      </Callout>
    </>
  );
}
