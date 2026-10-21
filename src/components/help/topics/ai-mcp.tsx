import { Lead, H2, H3, P, UL, LI, Steps, Callout, DefList, Def, UI } from "@/components/help/prose";

export default function AiMcp() {
  return (
    <>
      <Lead>
        IDStudio is an <strong>MCP server</strong>. MCP (Model Context Protocol) is how AI assistants such as Claude connect to the tools
        you use. Once connected, you can ask Claude to look things up and do the work in your workspace: &ldquo;What&rsquo;s waiting on
        me?&rdquo;, &ldquo;Turn Dana&rsquo;s review comments into cards&rdquo;, &ldquo;Draft three screens on phishing for the Module 1
        storyboard.&rdquo;
      </Lead>

      <H2>Connect Claude.ai or Claude Desktop</H2>
      <Steps>
        <>
          In IDStudio, open <UI>Settings → AI &amp; MCP</UI> and copy the server URL. It ends in <code>/api/mcp</code>.
        </>
        <>
          In Claude, open <UI>Settings → Connectors</UI>, choose <UI>Add custom connector</UI>, and paste the URL.
        </>
        <>
          Click <UI>Connect</UI>. You&rsquo;re sent to IDStudio to sign in. Pick the <strong>workspace</strong> Claude may use and the{" "}
          <strong>access</strong> (read and change, or read only), then <UI>Allow</UI>.
        </>
      </Steps>

      <H2>Connect Claude Code or another tool</H2>
      <P>
        In Claude Code, add the server and sign in through the browser with <code>/mcp</code>:
      </P>
      <pre className="my-3 overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs">claude mcp add --transport http idstudio https://your-idstudio/api/mcp</pre>
      <P>
        Tools that can&rsquo;t sign in through a browser use a <strong>personal token</strong> instead: <UI>Settings → AI &amp; MCP → New
        token</UI>, then send it as <code>Authorization: Bearer idst_…</code>. The token is shown once; store it like a password.
      </P>

      <H2>What an assistant can do</H2>
      <DefList>
        <Def term="Find and read">
          Search; your workspace&rsquo;s members, labels, statuses and sprints; My Work; boards and cards (by key such as SEC-12); projects
          with phases, deliverables, milestones and objectives; storyboards screen by screen; review rounds with every comment; all feedback on
          a deliverable; intake requests; sprints.
        </Def>
        <Def term="Plan and track">
          Create boards, columns and cards; update cards (description, due date, column, assignees, SMEs, labels, sprint); comment; add and tick
          subtasks; create projects, phases, deliverables, milestones, objectives and assessment items; log time; create and run sprints;
          triage intake (admins).
        </Def>
        <Def term="Design">
          Create storyboards, add and edit screens (on-screen text, narration, visuals, interaction, developer notes) and link them to
          objectives.
        </Def>
        <Def term="Review">
          Start review rounds, comment on a screen or a PDF page, resolve or won&rsquo;t-fix threads, record your own decision, and send
          comments to a board as cards.
        </Def>
      </DefList>
      <P>
        Text goes in and out as Markdown. Connected assistants also get ready-made <strong>prompts</strong>: a project status report,
        summarizing review feedback, drafting storyboard screens, triaging intake, and planning a sprint.
      </P>

      <H2>Access and safety</H2>
      <UL>
        <LI>
          An assistant acts <strong>as you</strong>, in <strong>one workspace</strong>, and sees only what you can see. Everything it does
          appears under your name, and the usual emails go out (to assignees, reviewers and so on).
        </LI>
        <LI>
          A read-only connection doesn&rsquo;t even see the tools that change things. Deleting is marked as destructive, so assistants ask
          before doing it.
        </LI>
        <LI>
          <UI>Settings → AI &amp; MCP</UI> lists your connections with when each was last used. Disconnect or revoke one and it stops at once.
          Admins can see and disconnect everyone&rsquo;s.
        </LI>
        <LI>Connected apps renew their access every hour, and stop after 30 days without use. Personal tokens expire when you chose.</LI>
      </UL>

      <Callout tone="tip">
        Start a conversation with something like &ldquo;Use IDStudio: what&rsquo;s waiting on me this week?&rdquo; The assistant learns
        your workspace from there.
      </Callout>

      <H3>Not included</H3>
      <P>
        Uploading files (attachments, PDFs for review), whiteboards, workspace settings, members and backups stay in the app.
      </P>
    </>
  );
}
