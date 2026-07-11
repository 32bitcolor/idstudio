import { Lead, H2, H3, P, UL, LI, Steps, Callout, DefList, Def, UI } from "@/components/help/prose";

export default function Whiteboards() {
  return (
    <>
      <Lead>
        <strong>Whiteboards</strong> are freeform Excalidraw canvases for the messy, visual part of
        design work — sketching a course flow, wireframing a screen, or mapping out ideas before
        they harden into storyboards and cards. They autosave as you draw, and they attach to your
        work in three different ways.
      </Lead>

      <H2>Drawing on a whiteboard</H2>
      <P>
        A whiteboard is a full Excalidraw canvas: shapes, arrows, text, freehand drawing, sticky
        frames, and images — the familiar toolset for quick diagrams and wireframes. Open one from the{" "}
        <UI>Whiteboards</UI> page (or from wherever it&rsquo;s linked) and start drawing.
      </P>
      <UL>
        <LI>
          <strong>Rename</strong> — edit the title in the header; it saves when you click away.
        </LI>
        <LI>
          <strong>Autosave</strong> — your scene saves automatically a moment after you stop drawing.
          There&rsquo;s no save button; just close the tab when you&rsquo;re done.
        </LI>
        <LI>
          <strong>Delete</strong> — use <UI>Delete</UI> in the header to remove the whiteboard (you
          &rsquo;ll be asked to confirm).
        </LI>
      </UL>

      <Callout tone="note">
        Saving is <em>last-write-wins</em> and debounced — it waits until your edits settle before
        persisting, so rapid changes don&rsquo;t thrash. Give it a second after your final stroke
        before navigating away.
      </Callout>

      <H2>The three ways whiteboards attach</H2>
      <P>
        A whiteboard is always its own thing, but where you create it determines what it&rsquo;s tied
        to — which shapes how you&rsquo;ll find it later:
      </P>

      <DefList>
        <Def term="Standalone">
          Created from the <UI>Whiteboards</UI> page. Belongs to the workspace on its own, unattached
          to any storyboard or card — perfect for scratch thinking and brainstorms.
        </Def>
        <Def term="Linked to a storyboard">
          Created from a storyboard&rsquo;s <UI>Whiteboards</UI> section (or linked to one afterward).
          Keeps a course&rsquo;s visual sketches next to its screens.
        </Def>
        <Def term="Created from a board card">
          Created via <UI>+ New whiteboard</UI> in a card&rsquo;s drawer. Stays tied to that card, so
          the sketch and the work item live together.
        </Def>
      </DefList>

      <H3>Create a standalone whiteboard</H3>
      <Steps>
        <>
          On the <UI>Whiteboards</UI> page, type a name into <UI>New whiteboard title…</UI>.
        </>
        <>
          Click <UI>Create whiteboard</UI> and open it from the grid to start drawing.
        </>
      </Steps>

      <H3>Change what a whiteboard is linked to</H3>
      <P>
        On any whiteboard, the header has a <UI>Storyboard</UI> dropdown. Pick a storyboard to link it,
        or choose <UI>— none —</UI> to detach it. That makes it easy to promote a standalone sketch
        into a specific course&rsquo;s working set once you know where it belongs.
      </P>

      <Callout tone="tip">
        Working inside a card or a storyboard? Create the whiteboard from there rather than the{" "}
        <UI>Whiteboards</UI> page — it&rsquo;ll come pre-linked, and you won&rsquo;t have to hunt for
        it or wire up the connection by hand later.
      </Callout>

      <H2>Finding your whiteboards</H2>
      <P>
        The <UI>Whiteboards</UI> page lists every whiteboard in the workspace, most recently updated
        first. Each card notes whether it&rsquo;s linked to a storyboard or standing on its own. Ones
        tied to a storyboard or card are also reachable directly from that storyboard&rsquo;s{" "}
        <UI>Whiteboards</UI> section or the card&rsquo;s drawer.
      </P>

      <Callout tone="note" title="Access">
        Whiteboards are visible to all workspace members by default. An admin can restrict one to
        specific groups from the workspace group settings; once restricted, only those groups (and
        admins) can open it, whether from the list or a direct link.
      </Callout>
    </>
  );
}
