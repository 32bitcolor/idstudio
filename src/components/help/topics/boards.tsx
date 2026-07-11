import { Lead, H2, H3, P, UL, LI, Steps, Callout, DefList, Def, UI } from "@/components/help/prose";

export default function Boards() {
  return (
    <>
      <Lead>
        A <strong>board</strong> is a Kanban view of your production pipeline — columns you move
        cards across as work progresses. Each card holds the real detail: a rich-text description,
        due date, labels, assignees, a checklist, comments, attachments, and linked whiteboards.
        It&rsquo;s where the day-to-day &ldquo;what&rsquo;s in flight and who has it&rdquo; lives.
      </Lead>

      <H2>Create a board and its columns</H2>
      <P>
        Boards live under <UI>Boards</UI> in the sidebar. Every board belongs to your workspace and
        starts empty — you shape the columns to match how your team works (for example{" "}
        <em>Backlog → In design → In development → Review → Done</em>).
      </P>

      <Steps>
        <>
          On the <UI>Boards</UI> page, type a name into <UI>New board name…</UI> and click{" "}
          <UI>Create board</UI>. Open it from the grid to start building.
        </>
        <>
          Click <UI>+ Add a column</UI> at the right edge, name it, and press Enter. Repeat for each
          stage of your pipeline.
        </>
        <>
          Reorder columns with the <UI>◀</UI> and <UI>▶</UI> arrows in the column header, rename a
          column by clicking its title, and remove one with <UI>×</UI> (this deletes the column and
          all its cards).
        </>
        <>
          Rename the board itself by clicking its title in the header. To remove it entirely, use{" "}
          <UI>Delete board</UI> — this permanently deletes every column and card on it.
        </>
      </Steps>

      <Callout tone="note">
        The number beside each column title is a live count of the cards in it — a quick read on
        where work is piling up.
      </Callout>

      <H2>Cards and drag-and-drop</H2>
      <P>
        Cards are the unit of work. Add one with <UI>+ Add a card</UI> at the bottom of any column —
        type a title and press Enter (Shift+Enter for a line break). To move a card, just drag it:
        within a column to reorder, or across columns to change its stage. Its new position saves
        automatically.
      </P>
      <P>
        Each card shows its at-a-glance state right on the face: colored label bars, a due-date chip
        (red when overdue), a checklist badge (green once every item is done), comment and attachment
        counts, and assignee initials. Click anywhere on a card to open the full detail drawer.
      </P>

      <H2>The card drawer, in depth</H2>
      <P>
        Opening a card slides in a drawer from the right with everything about it. Changes save as you
        go — there&rsquo;s no separate save button. Press <UI>Esc</UI> or click outside to close.
      </P>

      <DefList>
        <Def term="Title">
          Edit it at the top of the drawer; it updates on the card face when you click away.
        </Def>
        <Def term="Due date">
          Pick a calendar date, or <UI>Clear</UI> it. Due dates drive the board&rsquo;s due-date
          filters and the overdue chip on the card.
        </Def>
        <Def term="Labels">
          Toggle any of the board&rsquo;s labels on or off. Create a new one by typing a name, picking
          a color swatch, and clicking <UI>Add</UI> — labels are shared across the whole board.
        </Def>
        <Def term="Assignees">
          Click <UI>+ Assign</UI> to add workspace members. Their initials appear on the card face,
          and assigned cards surface in each person&rsquo;s My Work.
        </Def>
        <Def term="Checklist">
          Break the card into sub-tasks with <UI>Add an item…</UI>. Check items off; the header shows
          a running <em>done / total</em> count that mirrors onto the card.
        </Def>
        <Def term="Description">
          A rich-text field with bold, italic, an H2 heading, and bulleted or numbered lists. Click
          out of the editor to save.
        </Def>
        <Def term="Attachments">
          Upload files with <UI>+ Add file</UI> (up to 25 MB each), then <UI>Download</UI> or remove
          them. Great for source docs, exports, and reference material.
        </Def>
        <Def term="Whiteboards">
          Spin up a sketch tied to this card with <UI>+ New whiteboard</UI>, or open any already
          linked to it — handy for wireframing or mapping a flow in context.
        </Def>
        <Def term="Comments">
          A running discussion thread. Write a note and click <UI>Comment</UI>; you can delete your
          own comments (admins can delete any).
        </Def>
      </DefList>

      <Callout tone="tip">
        Need to sketch an idea while you&rsquo;re looking at a card? The card drawer&rsquo;s{" "}
        <UI>+ New whiteboard</UI> creates an Excalidraw canvas linked straight back to that card, so
        the drawing and the work item stay together.
      </Callout>

      <P>
        To remove a card, use <UI>Delete card</UI> at the bottom of the drawer (or the <UI>×</UI> that
        appears when you hover a card on the board).
      </P>

      <H2>Filtering the board</H2>
      <P>
        The filter bar above the columns narrows what&rsquo;s visible without touching your data. Filters
        stack — combine them to answer questions like &ldquo;overdue cards assigned to me with the{" "}
        <em>Compliance</em> label.&rdquo;
      </P>
      <UL>
        <LI>
          <strong>Search</strong> — type in <UI>Search cards…</UI> to match card titles.
        </LI>
        <LI>
          <strong>Labels</strong> and <strong>Assignees</strong> — open each dropdown and check the
          ones to filter by; the badge shows how many are active.
        </LI>
        <LI>
          <strong>Due date</strong> — choose <UI>Any due date</UI>, <UI>Overdue</UI>,{" "}
          <UI>Due this week</UI>, or <UI>No due date</UI>.
        </LI>
      </UL>
      <P>
        While any filter is active you&rsquo;ll see a <em>visible / total</em> count, and drag-and-drop
        is paused so you don&rsquo;t reorder a partial view by accident. Click <UI>Clear</UI> to reset
        everything and re-enable dragging.
      </P>

      <H3>How boards fit the pipeline</H3>
      <P>
        Boards are the execution layer beneath your projects. A project deliverable can link to a
        specific board card, so the planning view (phases, reviews, milestones) and the doing view
        (columns and cards) point at the same work. Use projects to plan the <em>what</em> and{" "}
        <em>when</em>; use boards to run the <em>day-to-day</em>.
      </P>

      <Callout tone="note" title="Access">
        By default every workspace member can see a board. An admin can restrict a board to specific
        groups from the workspace group settings — once restricted, only members of those groups (and
        admins) can find or open it, everywhere in the app.
      </Callout>
    </>
  );
}
