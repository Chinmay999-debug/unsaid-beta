// Load local env vars for convenience when running:
//   node scripts/test-gemini.mjs
try {
  if (typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(".dev.vars");
    } catch {}
    try {
      process.loadEnvFile(".env");
    } catch {}
  } else {
    const dotenv = await import("dotenv");
    dotenv.config({ path: ".dev.vars" });
    dotenv.config({ path: ".env" });
  }
} catch {}

const apiKey = (process.env.GEMINI_API_KEY || "").trim();
if (!apiKey) {
  console.error("Missing GEMINI_API_KEY in environment");
  process.exit(1);
}

const model = "gemini-2.0-flash";
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
  apiKey,
)}`;

const payload = {
  system_instruction: {
    parts: [
      {
        text: 'You are a calm, human, late-night companion. Reply in 1-2 short sentences. No "As an AI".',
      },
    ],
  },
  contents: [
    {
      role: "user",
      parts: [{ text: "feeling low lately" }],
    },
  ],
  generation_config: { temperature: 0.9, topP: 0.9, maxOutputTokens: 120 },
};

const started = Date.now();
const res = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload),
});

const text = await res.text();
console.log("status", res.status, "ms", Date.now() - started);
console.log("raw", text.slice(0, 1200));

try {
  const json = JSON.parse(text);
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const out = parts
    .map((p) => p.text)
    .filter(Boolean)
    .join("")
    .trim();
  console.log("extracted", out || "(EMPTY)");
} catch {
  console.log("non-json body");
}
