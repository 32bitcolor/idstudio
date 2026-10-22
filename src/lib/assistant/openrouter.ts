import "server-only";
import { appUrl } from "@/lib/app-url";

// OpenRouter (docs/ASSISTANT.md): one sign-in reaches Claude, GPT, Gemini and the rest.
// Its OAuth PKCE flow hands back an API key the member controls (and can delete in
// their OpenRouter settings); chat goes through its OpenAI-compatible endpoint.

// OPENROUTER_API_BASE exists for tests (a stand-in server); leave it unset.
const API = process.env.OPENROUTER_API_BASE?.replace(/\/+$/, "") || "https://openrouter.ai/api/v1";
export const DEFAULT_MODEL = "anthropic/claude-sonnet-5.5";

/** Suggested first in the model picker, if OpenRouter still lists them. */
export const RECOMMENDED_MODELS = [
  "anthropic/claude-sonnet-5.5",
  "anthropic/claude-opus-5.5",
  "anthropic/claude-haiku-5.5",
  "openai/gpt-5.6-terra",
  "google/gemini-3.8-flash",
  "deepseek/deepseek-v4.1-flash",
];

function headers(apiKey?: string): Record<string, string> {
  return {
    "content-type": "application/json",
    // OpenRouter shows these as the app on the member's activity page.
    "HTTP-Referer": appUrl("/") ?? "https://tavoro.app",
    "X-Title": "Tavoro",
    ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
  };
}

export function authorizeUrl(callbackUrl: string, codeChallenge: string): string {
  return "https://openrouter.ai/auth?" + new URLSearchParams({ callback_url: callbackUrl, code_challenge: codeChallenge, code_challenge_method: "S256" });
}

export async function exchangeCode(code: string, verifier: string): Promise<string> {
  const res = await fetch(`${API}/auth/keys`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" }),
    signal: AbortSignal.timeout(15000),
  });
  const body = (await res.json().catch(() => ({}))) as { key?: string; error?: { message?: string } };
  if (!res.ok || !body.key) throw new Error(body.error?.message ?? `OpenRouter answered ${res.status}`);
  return body.key;
}

export type KeyInfo = { usage: number; limit: number | null; limitRemaining: number | null; freeTier: boolean };

/** Spend and limit on the member's key, for Settings. Null if OpenRouter can't be reached. */
export async function keyInfo(apiKey: string): Promise<KeyInfo | null> {
  try {
    const res = await fetch(`${API}/key`, { headers: headers(apiKey), signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!res.ok) return null;
    const { data } = (await res.json()) as { data: { usage: number; limit: number | null; limit_remaining: number | null; is_free_tier: boolean } };
    return { usage: data.usage, limit: data.limit, limitRemaining: data.limit_remaining, freeTier: data.is_free_tier };
  } catch {
    return null;
  }
}

export type ModelOption = { id: string; name: string; promptPerM: number; completionPerM: number };
let modelCache: { at: number; models: ModelOption[] } | null = null;

/** Models that can call tools (the assistant is useless without), cached for an hour. */
export async function listModels(): Promise<ModelOption[]> {
  if (modelCache && Date.now() - modelCache.at < 3600_000) return modelCache.models;
  try {
    const res = await fetch(`${API}/models`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    const { data } = (await res.json()) as {
      data: { id: string; name: string; supported_parameters?: string[]; pricing: { prompt: string; completion: string } }[];
    };
    const models = data
      .filter((m) => m.supported_parameters?.includes("tools") && !m.id.endsWith(":batch"))
      .map((m) => ({ id: m.id, name: m.name, promptPerM: Number(m.pricing.prompt) * 1e6, completionPerM: Number(m.pricing.completion) * 1e6 }))
      .sort((a, b) => a.name.localeCompare(b.name));
    modelCache = { at: Date.now(), models };
    return models;
  } catch {
    return modelCache?.models ?? RECOMMENDED_MODELS.map((id) => ({ id, name: id, promptPerM: 0, completionPerM: 0 }));
  }
}

// ── chat ──────────────────────────────────────────────────────────────────────

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
export type ToolDef = { type: "function"; function: { name: string; description: string; parameters: unknown } };
export type Usage = { prompt_tokens?: number; completion_tokens?: number; cost?: number };

export class ProviderError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

/** One streamed completion. Text arrives through onText; the finished turn comes back. */
export async function streamChat(opts: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  tools: ToolDef[];
  signal: AbortSignal;
  onText: (delta: string) => void;
}): Promise<{ content: string; toolCalls: ToolCall[]; usage: Usage | null; finish: string | null }> {
  const res = await fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: headers(opts.apiKey),
    body: JSON.stringify({ model: opts.model, messages: opts.messages, tools: opts.tools, stream: true, usage: { include: true } }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    const msg = body.error?.message ?? `OpenRouter answered ${res.status}`;
    throw new ProviderError(
      res.status === 401 ? "OpenRouter rejected the key. Reconnect OpenRouter in the assistant." : res.status === 402 ? `Out of OpenRouter credit: ${msg}` : msg,
      res.status,
    );
  }

  let content = "";
  let usage: Usage | null = null;
  let finish: string | null = null;
  const calls: { id: string; name: string; args: string }[] = [];
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += value;
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      // Comments (": OPENROUTER PROCESSING") keep the connection alive; skip them.
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      let chunk: {
        error?: { message?: string };
        usage?: Usage;
        choices?: { delta?: { content?: string | null; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] }; finish_reason?: string | null }[];
      };
      try {
        chunk = JSON.parse(data);
      } catch {
        continue;
      }
      if (chunk.error) throw new ProviderError(chunk.error.message ?? "The model stopped with an error.");
      if (chunk.usage) usage = chunk.usage;
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      if (choice.finish_reason) finish = choice.finish_reason;
      const d = choice.delta;
      if (d?.content) {
        content += d.content;
        opts.onText(d.content);
      }
      for (const tc of d?.tool_calls ?? []) {
        const slot = (calls[tc.index] ??= { id: "", name: "", args: "" });
        if (tc.id) slot.id = tc.id;
        if (tc.function?.name) slot.name += tc.function.name;
        if (tc.function?.arguments) slot.args += tc.function.arguments;
      }
    }
  }
  const toolCalls = calls
    .filter((c) => c && c.name)
    .map((c, i) => ({ id: c.id || `call_${Date.now()}_${i}`, type: "function" as const, function: { name: c.name, arguments: c.args || "{}" } }));
  return { content, toolCalls, usage, finish };
}
