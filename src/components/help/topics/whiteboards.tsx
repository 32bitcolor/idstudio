import { Lead, H2, H3, P, UL, LI, Steps, Callout, DefList, Def, UI, Screenshot } from "@/components/help/prose";

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
      <Screenshot name="whiteboard" alt="An Excalidraw whiteboard sketching a learner journey, with its linked storyboard shown in the header" caption="A whiteboard linked to a storyboard." />
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
          <strong>Delete</strong> — open the <UI>⋯</UI> (<UI>Whiteboard settings</UI>) menu in the
          header and choose <UI>Delete whiteboard…</UI> (you&rsquo;ll be asked to confirm).
        </LI>
      </UL>

      <H2>Working on one together</H2>
      <P>
        Several people can have the same whiteboard open. Each save merges shape by shape instead of
        replacing the whole drawing, and an open whiteboard picks up everyone else&rsquo;s changes every few
        seconds, without reloading. If two people change the <em>same</em> shape at once, the later change
        wins; everything else is kept.
      </P>
      <Callout tone="note">
        Saving waits until your edits settle, so give it a second after your final stroke before closing
        the tab. Scrolling and zooming don&rsquo;t count as changes.
      </Callout>

      <H2>Drawing with an AI assistant</H2>
      <P>
        An assistant connected to Tavoro (see <UI>AI assistants (MCP)</UI>) can read a whiteboard and draw
        on it. Ask it to sketch a course map, a learner journey or a branching scenario, and it adds labelled
        boxes, sticky notes, frames and arrows, laid out for you. It can also move, relabel, recolour or
        delete what&rsquo;s there, or turn a whiteboard into a summary. Its changes appear on an open
        whiteboard within a few seconds and never overwrite what you&rsquo;re drawing.
      </P>
      <P>
        An assistant reads a whiteboard as its text and what connects to what. It doesn&rsquo;t see
        freehand drawings or the inside of images.
      </P>

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
          Choose <UI>New whiteboard</UI> on the <UI>Whiteboards</UI> page (or <UI>New → Whiteboard</UI>
          in the header) and type a name in <UI>Whiteboard title…</UI>.
        </>
        <>
          Choose <UI>Create</UI>. The canvas opens straight away.
        </>
      </Steps>

      <H3>Change what a whiteboard is linked to</H3>
      <P>
        On any whiteboard, the header has a linked-storyboard dropdown. Pick a storyboard to link it,
        or choose <UI>No linked storyboard</UI> to detach it. That makes it easy to promote a standalone sketch
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
        specific groups in <UI>Settings → Groups</UI>; once restricted, only those groups (plus admins
        and managers) can open it, whether from the list or a direct link.
      </Callout>
    </>
  );
}
