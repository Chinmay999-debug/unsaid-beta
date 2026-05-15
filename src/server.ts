import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;
let localEnvAttempted = false;
let wsPolyfillAttempted = false;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

async function tryLoadLocalEnvFiles() {
  if (localEnvAttempted) return;
  localEnvAttempted = true;

  // In Cloudflare, secrets should come via `env` bindings (hydrated below).
  // In local dev, that binding may be empty; we fall back to loading dotfiles.
  const loadEnvFile = (process as unknown as { loadEnvFile?: (path?: string) => void }).loadEnvFile;
  if (typeof loadEnvFile === "function") {
    try {
      loadEnvFile(".dev.vars");
    } catch {
      // ignore
    }
    try {
      loadEnvFile(".env");
    } catch {
      // ignore
    }
    return;
  }

  // Older Node runtimes: best-effort dotenv load (won't exist in some Worker contexts).
  try {
    const dotenv = await import("dotenv");
    dotenv.config({ path: ".dev.vars" });
    dotenv.config({ path: ".env" });
  } catch {
    // ignore
  }
}

async function ensureNodeWebSocketSupport() {
  if (wsPolyfillAttempted) return;
  wsPolyfillAttempted = true;

  // Supabase Realtime requires a WebSocket implementation in Node < 22.
  const hasNode = typeof process !== "undefined" && !!process.versions?.node;
  const wsGlobal = globalThis as unknown as { WebSocket?: unknown };
  if (!hasNode || wsGlobal.WebSocket) return;

  try {
    const wsMod = await import("ws");
    const WS =
      (wsMod as unknown as { default?: unknown }).default ??
      (wsMod as unknown as { WebSocket?: unknown }).WebSocket;
    if (WS) wsGlobal.WebSocket = WS;
  } catch {
    // ignore
  }
}

function envValueIsUnset(v: string | undefined): boolean {
  return v == null || v === "";
}

function hydrateProcessEnv(env: unknown) {
  if (!env || typeof env !== "object") return;
  const record = env as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (typeof key !== "string") continue;
    if (value == null) continue;
    // Prefer runtime Worker bindings over empty build-time placeholders (Vite/define
    // often sets missing `process.env.*` to "").
    if (typeof value === "string") {
      if (value === "") continue;
      if (!envValueIsUnset(process.env[key])) continue;
      process.env[key] = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      if (!envValueIsUnset(process.env[key])) continue;
      process.env[key] = String(value);
    }
  }
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      await ensureNodeWebSocketSupport();
      await tryLoadLocalEnvFiles();
      // Cloudflare Workers provide secrets via the `env` binding.
      // Hydrate them into process.env so server functions can read them safely.
      hydrateProcessEnv(env);
      const url = new URL(request.url);
      if (process.env.DEBUG_GEMINI === "1" && url.pathname.startsWith("/_serverFn/")) {
        console.log("[Server] serverFn request", { method: request.method, path: url.pathname });
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
