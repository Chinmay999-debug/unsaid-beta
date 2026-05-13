const MODEL_NAME = "gemini-2.0-flash";

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }
  return apiKey;
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

type GeminiPart = { text: string };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

function toGeminiContents(turns: ChatTurn[]): GeminiContent[] {
  return turns.map((t) => ({
    role: t.role === "assistant" ? "model" : "user",
    parts: [{ text: t.content }],
  }));
}

function extractGeminiTextFromJson(json: unknown): string {
  const candidates = (json as { candidates?: unknown } | null | undefined)?.candidates;
  if (!Array.isArray(candidates) || !candidates.length) return "";
  const content = (candidates[0] as { content?: unknown } | null | undefined)?.content;
  const parts = (content as { parts?: unknown } | null | undefined)?.parts;
  if (!Array.isArray(parts) || !parts.length) return "";
  const text = parts
    .map((p) => (p as { text?: unknown } | null | undefined)?.text)
    .filter((t): t is string => typeof t === "string")
    .join("");
  return text.trim();
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

function extractGeminiErrorMessage(json: unknown): string {
  const msg = (json as { error?: unknown } | null | undefined)?.error as
    | { message?: unknown }
    | undefined;
  return typeof msg?.message === "string" ? msg.message.trim() : "";
}

async function geminiGenerateContent(opts: {
  system: string;
  contents: GeminiContent[];
  generationConfig: { temperature: number; topP: number; maxOutputTokens: number };
}): Promise<{ text: string; raw: unknown }> {
  const apiKey = getApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${encodeURIComponent(
    apiKey,
  )}`;

  const payload = {
    system_instruction: { parts: [{ text: opts.system }] },
    contents: opts.contents,
    generation_config: opts.generationConfig,
  };

  const started = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const bodyText = await res.text();
  let json: unknown = null;
  try {
    json = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    json = { _nonJsonBody: bodyText };
  }

  if (!res.ok) {
    const apiMsg = extractGeminiErrorMessage(json);
    console.error("[GeminiFetch] HTTP error", {
      status: res.status,
      ms: Date.now() - started,
      body: safeJsonPreview(json),
    });
    throw new Error(apiMsg ? `Gemini HTTP ${res.status}: ${apiMsg}` : `Gemini HTTP ${res.status}`);
  }

  const text = extractGeminiTextFromJson(json);
  if (!text) {
    console.error("[GeminiFetch] empty-text", {
      ms: Date.now() - started,
      raw: safeJsonPreview(json),
    });
  } else if (process.env.DEBUG_GEMINI === "1") {
    console.log("[GeminiFetch] ok", {
      ms: Date.now() - started,
      extractedLen: text.length,
      raw: safeJsonPreview(json),
    });
  }

  return { text, raw: json };
}

export async function geminiChat(opts: { system: string; turns: ChatTurn[] }): Promise<string> {
  const { text } = await geminiGenerateContent({
    system: opts.system,
    contents: toGeminiContents(opts.turns),
    generationConfig: { temperature: 0.9, topP: 0.9, maxOutputTokens: 320 },
  });
  return text;
}

export async function geminiOneShot(opts: { system: string; prompt: string }): Promise<string> {
  const { text } = await geminiGenerateContent({
    system: opts.system,
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: { temperature: 0.95, topP: 0.9, maxOutputTokens: 180 },
  });
  return text;
}
