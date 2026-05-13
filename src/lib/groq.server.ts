const MODEL_NAME = "llama-3.1-8b-instant";

function getApiKey(): string {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY");
  }
  return apiKey;
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function toGroqMessages(opts: { system: string; turns: ChatTurn[] }): GroqMessage[] {
  const msgs: GroqMessage[] = [{ role: "system", content: opts.system }];
  for (const t of opts.turns) msgs.push({ role: t.role, content: t.content });
  return msgs;
}

function safeJsonPreview(value: unknown, max = 2000): string {
  try {
    const s = JSON.stringify(value);
    if (s.length <= max) return s;
    return s.slice(0, max) + "…(truncated)";
  } catch {
    return "[unstringifiable]";
  }
}

function extractGroqText(json: unknown): string {
  const choices = (json as { choices?: unknown } | null | undefined)?.choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const msg = (choices[0] as { message?: unknown } | null | undefined)?.message as
    | { content?: unknown }
    | undefined;
  return typeof msg?.content === "string" ? msg.content.trim() : "";
}

function extractGroqErrorMessage(json: unknown): string {
  const msg = (json as { error?: unknown } | null | undefined)?.error as
    | { message?: unknown }
    | undefined;
  return typeof msg?.message === "string" ? msg.message.trim() : "";
}

async function groqChatCompletions(opts: {
  messages: GroqMessage[];
  temperature: number;
  maxTokens: number;
}): Promise<{ text: string; raw: unknown }> {
  const apiKey = getApiKey();
  const started = Date.now();
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: opts.messages,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
    }),
  });

  const bodyText = await res.text();
  let json: unknown = null;
  try {
    json = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    json = { _nonJsonBody: bodyText };
  }

  if (!res.ok) {
    const apiMsg = extractGroqErrorMessage(json);
    console.error("[GroqFetch] HTTP error", {
      status: res.status,
      ms: Date.now() - started,
      body: safeJsonPreview(json),
    });
    throw new Error(apiMsg ? `Groq HTTP ${res.status}: ${apiMsg}` : `Groq HTTP ${res.status}`);
  }

  const text = extractGroqText(json);
  if (!text) {
    console.error("[GroqFetch] empty-text", {
      ms: Date.now() - started,
      raw: safeJsonPreview(json),
    });
  } else if (process.env.DEBUG_GEMINI === "1") {
    // Reuse existing debug flag for convenience.
    console.log("[GroqFetch] ok", { ms: Date.now() - started, extractedLen: text.length });
  }

  return { text, raw: json };
}

export async function groqChat(opts: { system: string; turns: ChatTurn[] }): Promise<string> {
  const { text } = await groqChatCompletions({
    messages: toGroqMessages(opts),
    temperature: 0.9,
    maxTokens: 320,
  });
  return text;
}

export async function groqOneShot(opts: { system: string; prompt: string }): Promise<string> {
  const { text } = await groqChatCompletions({
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.prompt },
    ],
    temperature: 0.95,
    maxTokens: 180,
  });
  return text;
}
