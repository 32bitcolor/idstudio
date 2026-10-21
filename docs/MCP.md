# IDStudio as an MCP server

*Built 2026-10-22.* IDStudio speaks the [Model Context Protocol](https://modelcontextprotocol.io), so
Claude (Claude.ai, Claude Desktop, Claude Code) and other MCP clients can read and work in a workspace
as a signed-in member. This doc records what was built and why.

## Decisions

1. **One remote endpoint, every client.** `POST /api/mcp`, Streamable HTTP transport, **stateless**
   (a fresh server per request, JSON responses, no sessions). `GET` and `DELETE` answer 405, as the
   spec allows. An open GET event stream carried nothing here, and through Cloudflare it held up the
   client's next request.
2. **Two kinds of credential, one table.** `ApiToken` rows are either *personal tokens*
   (`idst_…`, made in Settings, pasted into a client) or *OAuth connections* (`idsto_…` access +
   `idstr_…` refresh, issued after the consent screen). Only SHA-256 hashes are stored. Each one acts
   as **one user in one workspace** with scope `read` or `read write`.
3. **MCP reuses the app's permission model instead of copying it.** The route authenticates the
   bearer token and runs the whole request inside `runAsPrincipal()` (`AsyncLocalStorage`,
   `lib/principal.ts`). `getSession()` returns the token's user and workspace from there, so
   `getCurrentUser`, `getActiveMembership`, every `get…ForUser` check and every server action behave
   exactly as they do in the browser. While a principal is set, `authz.ts` also limits workspace
   ownership and elevated roles to the token's workspace, so a token can't reach another workspace
   the same user belongs to, and `getActiveMembership` never falls back to another workspace.
4. **Tools are thin wrappers over server actions.** Writes call the same actions the UI calls
   (validation, revalidation, emails, notifications included). Reads query Prisma with the same
   visibility `where` fragments the pages use. Write tools aren't even registered for a read-only
   connection. Every tool carries MCP annotations (`readOnlyHint`, `destructiveHint`,
   `idempotentHint`) so clients can ask before deleting.
5. **Markdown at the boundary.** Descriptions, comments and storyboard fields are TipTap JSON in the
   database and Markdown in tools (`lib/markdown.ts`, both directions: headings, lists (nested),
   quotes, code, bold/italic/strike/code, links, hard breaks). Mentions become `@Name` text; MCP
   writes don't send mention emails.
6. **OAuth 2.1 built in, public clients only.** IDStudio is both the authorization server and the
   resource server:
   - RFC 9728 protected-resource metadata and RFC 8414 server metadata, at the `/.well-known/…` paths
     through `next.config.ts` rewrites (the App Router can't route a dot-folder);
   - RFC 7591 dynamic registration (open, throttled to 20/hour per IP; redirect URIs must be https,
     loopback http, or an app scheme, never `javascript:`/`data:`/`file:`);
   - authorization-code flow with **PKCE S256 required** and a consent page at `/oauth/authorize`
     where the member picks the workspace and access level;
   - 10-minute single-use codes, 1-hour access tokens, 30-day refresh tokens rotated on every use
     (the old refresh and access tokens die immediately); RFC 7009 revocation.

   The 401 from `/api/mcp` carries `WWW-Authenticate: Bearer resource_metadata=…`, which is how
   Claude.ai and Claude Desktop discover all of this from just the URL.
7. **People stay in control.** Settings → **AI & MCP** shows each connection with last use, and
   revokes it at once. Admins see and can revoke everyone's in their workspace. Tokens can only be
   created from the browser, never through MCP. Login now honours `?next=` (same-site paths only),
   so signing in mid-flow returns to the consent page.

## What's exposed

**Tools (49 with read and write access, 16 read-only):**

| Area | Read | Write |
| ---- | ---- | ----- |
| Workspace | `get_workspace` (you, access, members, statuses, labels, sprints), `search`, `get_my_work` | |
| Boards & cards | `list_boards`, `get_board`, `get_card` (by id or key, e.g. SEC-12) | `create_board`, `create_column`, `create_card`, `update_card` (title, Markdown description, due, column, assignees, SMEs, labels, sprint), `add_card_comment`, `add_subtasks`, `set_subtask_done`, `delete_card`* |
| Projects | `list_projects`, `get_project` | `create_project`, `update_project`, `delete_project`*, `add_phase`, `update_phase`, `create_deliverable`, `update_deliverable`, `create_milestone`, `update_milestone`, `add_objective`, `add_assessment_item`, `log_time` |
| Storyboards | `list_storyboards`, `get_storyboard` | `create_storyboard`, `update_storyboard`, `add_screens`, `update_screen` (fields, position, objectives), `delete_screen`* |
| Reviews | `list_reviews`, `get_review_round`, `get_deliverable_feedback` | `add_review_comment` (on a screen and field with a quote, a PDF page, or the whole round; or a reply), `set_review_comment_status`, `decide_review`, `start_review_round`, `send_comments_to_board` |
| Planning | `list_intake`, `get_intake`, `get_sprint` | `triage_intake`, `create_sprint`, `update_sprint` |

\* destructive

**Resources:** `idstudio://project/{id}`, `idstudio://board/{id}`, `idstudio://storyboard/{id}`,
`idstudio://card/{ref}` and `idstudio://review-round/{id}`, as JSON. All except cards are listable.

**Prompts:** `status_report`, `summarize_feedback`, `draft_storyboard`, `triage_intake`,
`plan_sprint`. Each one embeds the relevant data and asks the model to confirm before changing
anything.

## Not exposed (on purpose)

Uploads (attachments, review files) and whiteboards stay in the browser. So do workspace settings,
members, groups, backups and self-update, and guest-link management (copy, reset, revoke). Personal
tokens can't be minted over MCP. Backups don't include tokens or OAuth clients: a restored workspace
has no working credentials.

## Operations

- Rate limit: 600 MCP requests per minute per credential (Redis, fails open).
- Nightly at 04:30 UTC, the worker's maintenance job (`lib/oauth-sweep.ts`) deletes codes expired
  for a day, tokens revoked or dead for 30 days, and clients that registered 7+ days ago but never
  connected.
- Code: `src/app/api/mcp/route.ts`, `src/lib/mcp/` (server, util, tools/*), `src/lib/api-tokens.ts`,
  `src/lib/oauth.ts`, `src/app/api/oauth/*`, `src/app/(auth)/oauth/authorize`,
  `src/app/actions/{oauth,api-tokens}.ts`, `src/components/settings/ai-settings.tsx`.

## Ideas for later

- Uploading a PDF to start a file review round from a client (MCP has no file transfer yet; it'd
  need a URL to fetch or base64, capped at 95 MB).
- Whiteboard read access (the Excalidraw scene as a summary of its text).
- Server-sent notifications (`listChanged`, resource subscriptions) once a stateful transport is
  worth it.
