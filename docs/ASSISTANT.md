# The in-app assistant

*Built 2026-10-22.* A chat panel docked beside every page. Members ask about their workspace and have
the assistant do the work: it reads freely and asks before every change. It runs on a model from the
member's own OpenRouter account. This doc records what was built and why.

## Decisions

1. **Sign in with OpenRouter, not with ChatGPT or Claude.** Consumer plans (ChatGPT Plus, Claude Pro)
   can't be used by third-party apps: Anthropic doesn't allow claude.ai login in third-party products,
   and OpenAI's "Sign in with ChatGPT" isn't open to them. OpenRouter has a real OAuth (PKCE) flow
   that hands back an API key the member controls, and one account reaches Claude, GPT, Gemini,
   DeepSeek and the rest. Usage is billed to the member's OpenRouter account.
2. **The key never reaches the browser.** `AssistantConnection` stores it AES-256-GCM encrypted
   (`lib/assistant/crypto.ts`, key derived from `SESSION_SECRET` by HKDF), one per member. Settings
   shows the last four characters and the spend OpenRouter reports. Disconnecting deletes the row;
   the key itself is retired in OpenRouter's settings. Rotating `SESSION_SECRET` makes stored keys
   unreadable, and members reconnect.
3. **The same tools as MCP, in-process.** The loop (`lib/assistant/agent.ts`) builds the MCP server
   and a client joined by an in-memory transport, inside `runAsPrincipal()` for the member and their
   active workspace. So the assistant has exactly the 50 tools outside assistants get, with the same
   permission checks, Markdown handling, emails and notifications, and there is one tool layer to
   maintain. Nothing goes over the network except the chat itself.
4. **Reads run; changes wait for approval.** Tools marked `readOnlyHint` run immediately. Any other
   call stops the loop and the panel shows an approval card with the tool and its arguments (deletes
   flagged). The next request carries the member's decisions; approved calls run, declined ones go
   back to the model as "The user declined this action". Sending a new message instead declines
   whatever was waiting. Pending calls are just tool calls without results in the stored
   conversation, so they survive a reload.
5. **Conversations are stored in the model's own format.** `AssistantConversation` /
   `AssistantMessage` keep messages as OpenAI-format chat messages (which OpenRouter speaks), so a
   chat resumes exactly. The model sees the last 80 messages; tool results are capped at 24k
   characters; a turn stops after 12 model calls.
6. **The page is context.** The panel sends the current path. `lib/assistant/context.ts` turns it into
   one line for the system prompt ("They have card card:… open; 'this card' means it."). Only
   id-shaped text from the URL goes in, never names looked up without an access check.
7. **Streaming over a plain POST.** `POST /api/assistant/chat` answers with server-sent events
   (`conversation`, `text`, `tool`, `approval`, `done`, `error`). It needs a session, a JSON body (so
   a cross-site form can't post), and an Origin of this app; 40 turns a minute per member. Stopping
   in the panel aborts the request, which aborts the model call; text already streamed is kept.
8. **Admins can turn it off.** `Workspace.assistantEnabled` (Settings → AI & MCP). Off means the panel
   says so and the API refuses.

## Pieces

- `src/lib/assistant/`: `openrouter.ts` (OAuth helpers, models list cached an hour, streaming chat),
  `agent.ts` (the loop, approvals, tool catalog), `context.ts`, `crypto.ts`.
- `src/app/api/assistant/openrouter/{start,callback}`: PKCE sign-in; the verifier and return path ride
  in a 10-minute cookie scoped to those routes.
- `src/app/api/assistant/chat`: the streaming endpoint.
- `src/app/actions/assistant.ts`: models, model choice, history, delete, disconnect, admin switch.
  Browser only (refused under an MCP principal).
- `src/components/assistant/`: `assistant-panel.tsx` (provider, top-bar button, panel) and
  `markdown-view.tsx` (renders replies with `lib/markdown.ts`).
- `src/components/settings/assistant-settings.tsx`.

Not in backups: connections and conversations, like API tokens.

## Testing

`OPENROUTER_API_BASE` points the server at a stand-in for OpenRouter's API. The test VM ran a
scripted mock inside the app container for the end-to-end run (sign-in, reads, approve/decline,
refresh after a change, pending approval across a reload, history, model choice, provider errors,
admin switch, phone layout, disconnect). Leave it unset in production.

## Ideas for later

- Per-workspace keys set by an admin, and personal API keys for Anthropic, OpenAI and Gemini directly.
- A self-hosted model (any OpenAI-compatible server).
- Attachments in the chat, and reading whiteboards.
- Usage totals per member for admins.
