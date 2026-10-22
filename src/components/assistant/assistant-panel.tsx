"use client";

import { createContext, Suspense, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowUp,
  Ban,
  Check,
  ChevronDown,
  CircleAlert,
  History,
  Loader2,
  Plus,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MarkdownView } from "@/components/assistant/markdown-view";
import {
  assistantModels,
  deleteAssistantConversation,
  listAssistantConversations,
  loadAssistantConversation,
  setAssistantModel,
  type ChatItem,
} from "@/app/actions/assistant";
import type { AgentEvent, PendingCall } from "@/lib/assistant/agent";
import type { ModelOption } from "@/lib/assistant/openrouter";

// The in-app assistant (docs/ASSISTANT.md): a panel docked beside every page. It knows
// the page you're on, reads freely, and asks before every change.

type Status = { enabled: boolean; connected: boolean; isAdmin: boolean; model: string };

const Ctx = createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(null);
const OPEN_KEY = "tavoro-assistant-open";
const CONV_KEY = "tavoro-assistant-conversation";

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// Open or closed survives navigation and reloads (per browser), via localStorage.
const openListeners = new Set<() => void>();
function subscribeOpen(fn: () => void) {
  openListeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    openListeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}
function setOpen(v: boolean) {
  store(OPEN_KEY, v ? "1" : null);
  openListeners.forEach((fn) => fn());
}

export function AssistantProvider({ status, children }: { status: Status; children: ReactNode }) {
  const open = useSyncExternalStore(subscribeOpen, () => read(OPEN_KEY) === "1", () => false);
  return (
    <Ctx.Provider value={{ open, setOpen }}>
      {children}
      {/* useSearchParams needs a Suspense boundary above it. */}
      {open && (
        <Suspense fallback={null}>
          <AssistantPanel status={status} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </Ctx.Provider>
  );
}

export function AssistantButton() {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  return (
    <button
      type="button"
      onClick={() => ctx.setOpen(!ctx.open)}
      aria-pressed={ctx.open}
      title="Assistant"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground",
        ctx.open && "border-primary/40 text-primary",
      )}
    >
      <Sparkles className="size-4" />
      <span className="sr-only">Assistant</span>
    </button>
  );
}

function suggestionsFor(path: string): string[] {
  if (path.startsWith("/boards/") && path.includes("card=")) return ["Summarize this card", "Break this card into subtasks", "What's blocking this card?"];
  if (path.startsWith("/c/")) return ["Summarize this card", "Break this card into subtasks"];
  if (path.startsWith("/boards/")) return ["What's overdue on this board?", "Who has the most open cards here?"];
  if (path.startsWith("/storyboards/")) return ["Review this storyboard for clarity", "Draft two more screens for this storyboard"];
  if (path.startsWith("/reviews/feedback/")) return ["Summarize this feedback by theme", "Which comments are still open?"];
  if (path.startsWith("/reviews/")) return ["Summarize the feedback in this round", "Turn the open comments into cards"];
  if (path.startsWith("/projects/")) return ["Write a status report for this project", "Which objectives aren't assessed yet?"];
  if (path.startsWith("/intake")) return ["Which intake requests are highest impact?", "Summarize what's waiting for triage"];
  return ["What's waiting on me?", "What's due this week?", "Find cards about phishing"];
}

/** Arguments as short "key: value" lines for a tool row. */
function argSummary(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  return Object.entries(args as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => {
      const s = typeof v === "string" ? v : Array.isArray(v) ? (v.every((x) => typeof x === "string") ? v.join(", ") : `${v.length} items`) : JSON.stringify(v);
      return `${k.replace(/_/g, " ")}: ${s.length > 60 ? `${s.slice(0, 57)}…` : s}`;
    })
    .join(" · ");
}

function ToolRow({ item }: { item: Extract<ChatItem, { kind: "tool" }> }) {
  const icon =
    item.status === "running" ? (
      <Loader2 className="size-3.5 animate-spin" />
    ) : item.status === "done" ? (
      <Check className="size-3.5 text-success" />
    ) : item.status === "declined" ? (
      <Ban className="size-3.5" />
    ) : (
      <CircleAlert className="size-3.5 text-destructive" />
    );
  const summary = argSummary(item.args);
  return (
    <details className="group rounded-md border border-border bg-surface text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-1.5 text-muted-foreground">
        {icon}
        <span className="font-medium text-foreground">{item.title}</span>
        {item.status === "declined" && <span>declined</span>}
        {summary && <span className="min-w-0 flex-1 truncate">{summary}</span>}
      </summary>
      {item.result && (
        <pre className="max-h-48 overflow-auto border-t border-border px-2.5 py-2 font-mono text-[11px] leading-snug whitespace-pre-wrap text-muted-foreground">{item.result}</pre>
      )}
    </details>
  );
}

function ArgValue({ value }: { value: unknown }) {
  if (typeof value === "string") {
    return value.length > 80 || value.includes("\n") ? (
      <div className="mt-0.5 max-h-40 overflow-auto rounded bg-muted px-2 py-1 whitespace-pre-wrap">{value}</div>
    ) : (
      <span>{value}</span>
    );
  }
  if (Array.isArray(value) && value.every((x) => typeof x === "string")) return <span>{value.join(", ")}</span>;
  return <div className="mt-0.5 max-h-40 overflow-auto rounded bg-muted px-2 py-1 font-mono text-[11px] whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</div>;
}

function ApprovalCard({
  calls,
  decisions,
  onDecide,
  onDecideAll,
  busy,
}: {
  calls: PendingCall[];
  decisions: Record<string, "approve" | "decline">;
  onDecide: (id: string, d: "approve" | "decline") => void;
  onDecideAll: (d: "approve" | "decline") => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
      <p className="mb-2 font-semibold">{calls.length === 1 ? "Approve this change?" : `Approve these ${calls.length} changes?`}</p>
      <div className="flex flex-col gap-2">
        {calls.map((c) => (
          <div key={c.id} className="rounded-md border border-border bg-background p-2.5">
            <div className="mb-1 flex items-center gap-2">
              <span className="font-medium">{c.title}</span>
              {c.destructive && <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-destructive">Deletes</span>}
              <span className="ml-auto text-xs text-muted-foreground">
                {decisions[c.id] === "approve" ? "Approved" : decisions[c.id] === "decline" ? "Declined" : ""}
              </span>
            </div>
            <dl className="space-y-1 text-xs">
              {Object.entries((c.args ?? {}) as Record<string, unknown>)
                .filter(([, v]) => v !== undefined && v !== null && v !== "")
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="inline font-medium text-muted-foreground">{k.replace(/_/g, " ")}: </dt>
                    <dd className="inline">
                      <ArgValue value={v} />
                    </dd>
                  </div>
                ))}
            </dl>
            {calls.length > 1 && !decisions[c.id] && (
              <div className="mt-2 flex gap-2">
                <Button size="xs" onClick={() => onDecide(c.id, "approve")} disabled={busy}>
                  Approve
                </Button>
                <Button size="xs" variant="outline" onClick={() => onDecide(c.id, "decline")} disabled={busy}>
                  Decline
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => onDecideAll("approve")} disabled={busy}>
          {calls.length === 1 ? "Approve" : "Approve all"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDecideAll("decline")} disabled={busy}>
          {calls.length === 1 ? "Decline" : "Decline all"}
        </Button>
      </div>
    </div>
  );
}

function AssistantPanel({ status, onClose }: { status: Status; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const path = `${pathname}${search.size ? `?${search}` : ""}`;

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [pending, setPending] = useState<PendingCall[]>([]);
  const [decisions, setDecisions] = useState<Record<string, "approve" | "decline">>({});
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(() => (search.get("assistant") === "failed" ? "Couldn't connect OpenRouter. Try again." : null));
  const [input, setInput] = useState("");
  const [menu, setMenu] = useState<null | "models" | "history">(null);
  const [models, setModels] = useState<{ recommended: ModelOption[]; all: ModelOption[]; current: string } | null>(null);
  const [model, setModel] = useState(status.model);
  // The panel only renders in the browser, so localStorage is safe here. Until the last
  // chat is back, sending would start a second one.
  const [ready, setReady] = useState(() => !(status.connected && read(CONV_KEY)));
  const [modelFilter, setModelFilter] = useState("");
  const [history, setHistory] = useState<{ id: string; title: string; updatedAt: Date }[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const changedRef = useRef(false);

  // Back from OpenRouter: tidy the URL (a failure was picked up as the first error).
  const connectedFlag = search.get("assistant");
  useEffect(() => {
    if (!connectedFlag) return;
    const u = new URL(window.location.href);
    u.searchParams.delete("assistant");
    router.replace(`${u.pathname}${u.search}`, { scroll: false });
  }, [connectedFlag, router]);

  const show = (id: string, res: Awaited<ReturnType<typeof loadAssistantConversation>>) => {
    if ("error" in res) {
      store(CONV_KEY, null);
      return;
    }
    setConversationId(id);
    setItems(res.items);
    setPending(res.pending);
    setDecisions({});
    setError(null);
    store(CONV_KEY, id);
  };
  const open = (id: string) => loadAssistantConversation(id).then((res) => show(id, res));

  // Pick up the last chat where it was left.
  useEffect(() => {
    const last = read(CONV_KEY);
    if (!last || !status.connected) return;
    let live = true;
    void loadAssistantConversation(last)
      .then((res) => live && show(last, res))
      .finally(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [status.connected]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [items, pending, streaming]);

  useEffect(() => {
    if (menu === "models" && !models) void assistantModels().then((r) => !("error" in r) && setModels(r));
    if (menu === "history") void listAssistantConversations().then(setHistory);
  }, [menu, models]);

  const newChat = () => {
    abortRef.current?.abort();
    setMenu(null);
    setConversationId(null);
    setItems([]);
    setPending([]);
    setDecisions({});
    setError(null);
    store(CONV_KEY, null);
  };

  const send = async (body: { message?: string; decisions?: Record<string, "approve" | "decline"> }) => {
    if (streaming || !ready) return;
    setError(null);
    setStreaming(true);
    changedRef.current = false;
    if (body.message) setItems((xs) => [...xs, { kind: "user", text: body.message! }]);
    setPending([]);
    setDecisions({});
    const ac = new AbortController();
    abortRef.current = ac;
    let textOpen = false;
    const handle = (e: AgentEvent) => {
      if (e.type === "conversation") {
        setConversationId(e.id);
        store(CONV_KEY, e.id);
      } else if (e.type === "text") {
        setItems((xs) => {
          const last = xs[xs.length - 1];
          if (textOpen && last?.kind === "assistant") return [...xs.slice(0, -1), { kind: "assistant", text: last.text + e.delta }];
          textOpen = true;
          return [...xs, { kind: "assistant", text: e.delta }];
        });
      } else if (e.type === "tool") {
        textOpen = false;
        if (e.write && e.status === "done") changedRef.current = true;
        setItems((xs) => {
          const i = xs.findIndex((x) => x.kind === "tool" && x.id === e.id);
          const item: ChatItem = { kind: "tool", id: e.id, name: e.name, title: e.title, args: e.args, status: e.status, result: e.result, write: e.write };
          return i >= 0 ? xs.map((x, k) => (k === i ? item : x)) : [...xs, item];
        });
      } else if (e.type === "approval") {
        setPending(e.calls);
      } else if (e.type === "error") {
        setError(e.message);
      }
    };
    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, conversationId, path }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `The assistant answered ${res.status}.`);
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += value;
        let cut: number;
        while ((cut = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, cut);
          buf = buf.slice(cut + 2);
          for (const line of chunk.split("\n")) if (line.startsWith("data: ")) handle(JSON.parse(line.slice(6)) as AgentEvent);
        }
      }
    } catch (e) {
      if (!ac.signal.aborted) setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setStreaming(false);
      abortRef.current = null;
      // Show what the assistant changed without a manual reload.
      if (changedRef.current) router.refresh();
    }
  };

  const decide = (id: string, d: "approve" | "decline") => {
    const next = { ...decisions, [id]: d };
    setDecisions(next);
    if (pending.every((c) => next[c.id])) void send({ decisions: next });
  };
  const decideAll = (d: "approve" | "decline") => {
    const next = Object.fromEntries(pending.map((c) => [c.id, decisions[c.id] ?? d]));
    void send({ decisions: next });
  };

  const submit = () => {
    const text = input.trim();
    if (!text || streaming || !ready) return;
    setInput("");
    void send({ message: text });
  };

  const filtered = useMemo(() => {
    if (!models) return [];
    const q = modelFilter.trim().toLowerCase();
    return q ? models.all.filter((m) => m.id.includes(q) || m.name.toLowerCase().includes(q)).slice(0, 40) : [];
  }, [models, modelFilter]);
  const pickModel = async (id: string) => {
    await setAssistantModel(id);
    setModel(id);
    setMenu(null);
    setModelFilter("");
  };
  const price = (m: ModelOption) => (m.promptPerM ? `$${m.promptPerM.toFixed(2)} / $${m.completionPerM.toFixed(2)} per M tokens` : "");

  return (
    <aside
      aria-label="Assistant"
      className="fixed inset-0 z-40 flex flex-col bg-background md:sticky md:top-0 md:z-0 md:h-svh md:w-[400px] md:shrink-0 md:border-l md:border-border"
    >
      <header className="relative flex h-14 shrink-0 items-center gap-1 border-b border-border px-3">
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        <span className="mr-auto font-semibold">Assistant</span>
        {status.enabled && status.connected && (
          <>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setMenu(menu === "models" ? null : "models")}>
              <span className="max-w-32 truncate">{model.split("/").pop()}</span>
              <ChevronDown className="size-3" />
            </Button>
            <Button variant="ghost" size="icon-sm" title="Past chats" onClick={() => setMenu(menu === "history" ? null : "history")}>
              <History className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" title="New chat" onClick={newChat}>
              <Plus className="size-4" />
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon-sm" title="Close" onClick={onClose}>
          <X className="size-4" />
        </Button>

        {menu && (
          <div className="absolute inset-x-2 top-full z-10 mt-1 max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-popover p-1.5 text-sm shadow-lg">
            {menu === "models" &&
              (!models ? (
                <p className="p-2 text-muted-foreground">Loading models…</p>
              ) : (
                <>
                  <p className="px-2 pb-1 pt-0.5 text-xs font-medium text-muted-foreground">Suggested</p>
                  {models.recommended.map((m) => (
                    <button key={m.id} type="button" onClick={() => pickModel(m.id)} className="flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-muted">
                      <span className="flex items-center gap-1.5">
                        {m.name}
                        {m.id === model && <Check className="size-3.5 text-primary" />}
                      </span>
                      <span className="text-xs text-muted-foreground">{price(m)}</span>
                    </button>
                  ))}
                  <input
                    value={modelFilter}
                    onChange={(e) => setModelFilter(e.target.value)}
                    placeholder={`Search all ${models.all.length} models…`}
                    className="mt-1.5 w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:border-ring"
                  />
                  {filtered.map((m) => (
                    <button key={m.id} type="button" onClick={() => pickModel(m.id)} className="flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-muted">
                      <span>{m.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {m.id} · {price(m)}
                      </span>
                    </button>
                  ))}
                </>
              ))}
            {menu === "history" &&
              (!history ? (
                <p className="p-2 text-muted-foreground">Loading…</p>
              ) : history.length === 0 ? (
                <p className="p-2 text-muted-foreground">No chats yet.</p>
              ) : (
                history.map((h) => (
                  <div key={h.id} className={cn("group flex items-center rounded-md hover:bg-muted", h.id === conversationId && "bg-muted")}>
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate px-2 py-1.5 text-left"
                      onClick={() => {
                        setMenu(null);
                        void open(h.id);
                      }}
                    >
                      {h.title}
                    </button>
                    <button
                      type="button"
                      title="Delete chat"
                      className="p-1.5 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                      onClick={async () => {
                        await deleteAssistantConversation(h.id);
                        setHistory((xs) => xs?.filter((x) => x.id !== h.id) ?? null);
                        if (h.id === conversationId) newChat();
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))
              ))}
          </div>
        )}
      </header>

      {!status.enabled ? (
        <div className="p-5 text-sm text-muted-foreground">
          An admin has turned the assistant off for this workspace.
          {status.isAdmin && (
            <>
              {" "}
              Turn it on in{" "}
              <Link href="/settings/ai" className="text-primary underline">
                Settings → AI &amp; MCP
              </Link>
              .
            </>
          )}
        </div>
      ) : !status.connected ? (
        <div className="flex flex-col gap-3 p-5 text-sm">
          <p className="font-semibold">Chat with your workspace</p>
          <p className="text-muted-foreground">
            Ask questions about your projects, boards, storyboards and reviews, and have the assistant do the work: create and update cards, draft screens,
            answer review comments. It acts as you, sees only what you can see, and asks before it changes anything.
          </p>
          <p className="text-muted-foreground">
            Connect your own <strong className="text-foreground">OpenRouter</strong> account to pick a model: Claude, GPT, Gemini and more. Usage is billed to
            your OpenRouter account.
          </p>
          {error && <p className="text-destructive">{error}</p>}
          <Button asChild className="self-start">
            <a href={`/api/assistant/openrouter/start?return=${encodeURIComponent(path)}`}>Sign in with OpenRouter</a>
          </Button>
          <p className="text-xs text-muted-foreground">You can disconnect any time in Settings → AI &amp; MCP.</p>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4" onClick={() => setMenu(null)}>
            {!ready ? (
              <Loader2 className="mt-6 size-4 animate-spin text-muted-foreground" aria-label="Loading" />
            ) : items.length === 0 && !streaming ? (
              <div className="flex flex-col gap-2 pt-6 text-sm">
                <p className="text-muted-foreground">Ask about this page, or anything in your workspace.</p>
                {suggestionsFor(path).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send({ message: s })}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-left transition-colors hover:border-border-strong"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {items.map((item, i) =>
                  item.kind === "user" ? (
                    <div key={i} className="ml-8 self-end rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
                      {item.text}
                    </div>
                  ) : item.kind === "assistant" ? (
                    <MarkdownView key={i} text={item.text} />
                  ) : (
                    <ToolRow key={item.id} item={item} />
                  ),
                )}
                {streaming && (items[items.length - 1]?.kind !== "assistant" || pending.length > 0) && (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Working" />
                )}
                {pending.length > 0 && !streaming && (
                  <ApprovalCard calls={pending} decisions={decisions} onDecide={decide} onDecideAll={decideAll} busy={streaming} />
                )}
              </div>
            )}
            {error && <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          </div>
          <form
            className="shrink-0 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {pending.length > 0 && <p className="mb-1.5 text-xs text-muted-foreground">Sending a message skips the changes above.</p>}
            <div className="flex items-end gap-2 rounded-lg border border-input bg-background px-2 py-1.5 focus-within:border-ring">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={Math.min(6, Math.max(1, input.split("\n").length))}
                placeholder={ready ? "Ask the assistant…" : "Loading your last chat…"}
                disabled={!ready}
                aria-label="Message the assistant"
                className="max-h-40 min-h-6 flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
              />
              {streaming ? (
                <Button type="button" size="icon-sm" variant="outline" title="Stop" onClick={() => abortRef.current?.abort()}>
                  <Square className="size-3.5" />
                </Button>
              ) : (
                <Button type="submit" size="icon-sm" title="Send" disabled={!input.trim()}>
                  <ArrowUp className="size-4" />
                </Button>
              )}
            </div>
          </form>
        </>
      )}
    </aside>
  );
}
