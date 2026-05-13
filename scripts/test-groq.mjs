// Convenience script:
//   node scripts/test-groq.mjs
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

const apiKey = (process.env.GROQ_API_KEY || "").trim();
if (!apiKey) {
  console.error("Missing GROQ_API_KEY in environment");
  process.exit(1);
}

const model = "llama-3.1-8b-instant";
const payload = {
  model,
  temperature: 0.9,
  max_tokens: 120,
  messages: [
    {
      role: "system",
      content:
        'You are a calm, human, late-night companion. Reply in 1-2 short sentences. No "As an AI".',
    },
    { role: "user", content: "feeling low lately" },
  ],
};

const started = Date.now();
const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify(payload),
});

const text = await res.text();
console.log("status", res.status, "ms", Date.now() - started);
console.log("raw", text.slice(0, 1200));

try {
  const json = JSON.parse(text);
  const out = json?.choices?.[0]?.message?.content?.trim?.() ?? "";
  console.log("extracted", out || "(EMPTY)");
} catch {
  console.log("non-json body");
}
