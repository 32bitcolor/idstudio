import { Lead, H2, H3, P, UL, LI, Steps, Callout, DefList, Def, UI } from "@/components/help/prose";

export default function Boards() {
  return (
    <>
      <Lead>
        A <strong>board</strong> is a Kanban view of your production pipeline — columns you move
        cards across as work progresses. Each card holds the real detail: a rich-text description,
        due date, labels, assignees and SMEs, subtasks, comments, attachments, linked whiteboards,
        and any review feedback sent to it. It&rsquo;s where the day-to-day &ldquo;what&rsquo;s in
        flight and who has it&rdquo; lives.
      </Lead>

      <H2>Create a board and shape its columns</H2>
      <P>
        Boards live under <UI>Boards</UI> in the sidebar. A board can stand on its own or belong to a
        project (create it from the project&rsquo;s <UI>Boards</UI> section). A new board starts with
        three columns — <em>To do</em>, <em>In progress</em>, <em>Done</em> — that you reshape to match
        how your team works.
      </P>
      <Steps>
        <>
          Choose <UI>New board</UI> on the <UI>Boards</UI> page (or <UI>New → Board</UI> in the header
          from anywhere), type a name in <UI>Board name…</UI>, and choose <UI>Create</UI>. The new
          board opens straight away.
        </>
        <>
          Add a stage with the <UI>+</UI> at the right end of the columns: name it in{" "}
          <UI>Column name…</UI> and choose <UI>Add column</UI>.
        </>
        <>
          Rename a column by clicking its title. Its <UI>⋯</UI> menu has <UI>Move left</UI>,{" "}
          <UI>Move right</UI>, and <UI>Delete column…</UI> (which deletes the column and its cards).
        </>
        <>
          Rename the board by clicking its title. The <UI>⋯</UI> (<UI>Board settings</UI>) menu beside
          the view switch sets the <UI>Card prefix</UI> and holds <UI>Delete board…</UI>, which
          permanently deletes every column and card on it.
        </>
      </Steps>

      <H3>Card keys</H3>
      <P>
        Give a board a <UI>Card prefix</UI> (for example <code>SEC</code>) and every card gets a short
        key like <code>SEC-12</code>, shown on the card and in the drawer. Keys make cards easy to
        mention in conversation and to refer to from AI assistants. Each board in a workspace needs its
        own prefix. Changing it re-labels the board&rsquo;s cards; the numbers stay the same.
      </P>

      <H2>Cards</H2>
      <P>
        Add a card with <UI>Add card</UI> at the bottom of a column, or <UI>New card</UI> in the board
        header, then type a title in <UI>Card title…</UI>. To move a card, drag it: within a column to
        reorder, or across columns to change its stage. Dragging works with filters on, too — a
        dropped card lands next to the card you can see. Positions save automatically.
      </P>
      <P>
        The card face shows its state at a glance: key, labels, a due-date chip (red when overdue), a
        subtask count (green once every subtask is done), comment and attachment counts, and the
        assignees. Click a card to open its drawer.
      </P>

      <H3>Board and list views</H3>
      <P>
        The <UI>Board</UI> / <UI>List</UI> switch in the header changes how the same cards are shown:
        columns you drag between, or a table grouped by column with key, title, labels, people, and due
        date. Filters apply to both.
      </P>

      <H2>The card drawer, in depth</H2>
      <P>
        Opening a card slides in a drawer with everything about it. Changes save as you go — there&rsquo;s
        no save button. Press <UI>Esc</UI> or use <UI>Close card</UI> to close it; <UI>J</UI> and{" "}
        <UI>K</UI> step to the next and previous card, and <UI>Copy shareable link</UI> copies a link
        that opens this card for anyone who can see the board.
      </P>

      <DefList>
        <Def term="Title">Edit it at the top of the drawer; the card face updates when you click away.</Def>
        <Def term="Description">
          Rich text with bold, italic, a heading, and bulleted or numbered lists. Type <UI>@</UI> to
          mention a teammate who can see the card — they get an email with a link straight back to it.
        </Def>
        <Def term="Subtasks">
          Break the card down with <UI>Add a subtask…</UI>. Each subtask is a small card of its own:
          tick it done, give it an assignee, or open it. The section header shows{" "}
          <em>done / total</em>, mirrored on the card face. Subtasks assigned to you show in My Work.
        </Def>
        <Def term="Review feedback">
          When review comments are sent to a board as cards (from a review round or a deliverable&rsquo;s
          feedback view), the card lists them here with where they were left, so the fix and the comment
          stay together.
        </Def>
        <Def term="Status">
          The column the card is in. Changing it here moves the card. Each column maps to one of the
          workspace&rsquo;s statuses (to do, in progress, done and so on), which drive the sprint board and
          cross-board views; a status change notifies the card&rsquo;s assignees and SMEs.
        </Def>
        <Def term="Due date">
          Pick a date, or <UI>Clear</UI> it. Due dates drive the due-date filter, the overdue chip, and
          reminder emails.
        </Def>
        <Def term="Sprint">
          On boards in a sprint-enabled project, assign the card to a <UI>Sprint</UI> to put it on that
          sprint&rsquo;s board (<UI>No sprint</UI> takes it off). See the Sprints guide.
        </Def>
        <Def term="Labels">
          Toggle any of the workspace&rsquo;s labels. Create one by typing in <UI>New label…</UI>, picking
          a color, and choosing <UI>Add</UI>. Labels are shared across the workspace; admins rename,
          recolor, and delete them in <UI>Settings → Labels</UI>.
        </Def>
        <Def term="Assignees and SMEs">
          <UI>+ Assign</UI> adds workspace members as assignees (who&rsquo;s doing it) or SMEs (who
          checks it for accuracy). Both are emailed when added and notified of comments, and assigned
          cards show in each person&rsquo;s My Work.
        </Def>
        <Def term="Attachments">
          Upload files up to 25 MB each, then <UI>Download</UI> or remove them.
        </Def>
        <Def term="Whiteboards">
          <UI>+ New whiteboard</UI> creates an Excalidraw canvas linked to this card, and lists any
          already linked — handy for wireframing a flow in context.
        </Def>
        <Def term="Comments">
          A rich-text discussion thread. Type <UI>@</UI> to mention someone (they&rsquo;re emailed); the
          card&rsquo;s assignees and SMEs are notified of new comments. You can delete your own comments,
          and admins can delete any.
        </Def>
      </DefList>

      <P>
        To remove a card, use <UI>Delete card</UI> at the bottom of the drawer, or the <UI>×</UI> that
        appears when you hover over a card on the board.
      </P>

      <H2>Filtering the board</H2>
      <P>
        The filter bar above the columns narrows what&rsquo;s visible without changing anything. Filters
        stack, so you can answer questions like &ldquo;overdue cards assigned to me with the{" "}
        <em>Compliance</em> label&rdquo;. While any filter is on, the bar shows <em>N of M cards</em>;{" "}
        <UI>Clear</UI> resets them all.
      </P>
      <UL>
        <LI>
          <strong>Search</strong> — type in <UI>Search cards</UI> to match card titles. (To jump to a card by its key, use the header&rsquo;s <UI>Search</UI>.)
        </LI>
        <LI>
          <strong>Label</strong> and <strong>Assignee</strong> — open each and check the ones to filter
          by; the button shows what&rsquo;s selected.
        </LI>
        <LI>
          <strong>Due date</strong> — <UI>Any due date</UI>, <UI>Overdue</UI>, <UI>Due this week</UI>, or{" "}
          <UI>No due date</UI>.
        </LI>
      </UL>

      <H3>Saved views</H3>
      <P>
        Once you&rsquo;ve set up a combination of filters you keep coming back to, open <UI>Views</UI>{" "}
        and choose <UI>Save current filters…</UI> to name it. Pick it from that menu any time to
        re-apply the whole combination; <UI>Clear view</UI> goes back to everything. Saved views are{" "}
        <strong>yours</strong>, not shared with the workspace, and a board&rsquo;s views stay with that
        board. Saving over a name you&rsquo;ve already used updates that view, and changing a filter by
        hand detaches the view so the menu never names one while showing something else. The team
        sprint board has its own <UI>Views</UI> menu that works the same way.
      </P>

      <H3>How boards fit the pipeline</H3>
      <P>
        Boards are the execution layer beneath your projects. A project&rsquo;s board shows a strip
        with the project&rsquo;s current phase, next milestone, and objective alignment above the
        columns, and a deliverable can link to a specific card, so the planning view and the doing view
        point at the same work. Use projects to plan the <em>what</em> and <em>when</em>; use boards to
        run the day-to-day.
      </P>

      <Callout tone="note">
        By default every workspace member can see a board. An admin can restrict it to specific groups
        in <UI>Settings → Groups</UI> — once restricted, only members of those groups (plus admins and
        managers) can find or open it, anywhere in the app.
      </Callout>
    </>
  );
}
