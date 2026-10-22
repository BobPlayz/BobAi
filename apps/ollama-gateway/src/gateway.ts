import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";

/**
 * Jarvis Ollama gateway.
 *
 * Runs next to Ollama (for example on your laptop) and is the only thing you expose to the internet, through an
 * HTTPS tunnel. Ollama itself stays bound to 127.0.0.1. The gateway:
 *   - requires `Authorization: Bearer <GATEWAY_TOKEN>` on every model request (constant-time comparison);
 *   - forwards only the endpoints Jarvis uses (chat, generate for unloading, embed, tags, ps) — never pull,
 *     delete, create, copy or push;
 *   - only allows the models listed in GATEWAY_ALLOWED_MODELS;
 *   - runs at most GATEWAY_MAX_CONCURRENT requests at once (default 1, right for 8 GB RAM) and queues a few more;
 *   - streams responses through, cancels Ollama work when the caller disconnects, and enforces timeouts.
 */
export type GatewayConfig = {
  ollamaUrl: string;
  token: string;
  allowedModels: string[];
  maxConcurrent: number;
  queueLimit: number;
  timeoutMs: number;
  maxBodyBytes: number;
  rateLimitPerMinute: number;
};

type Route = { method: "GET" | "POST"; path: string; model: boolean };
const ROUTES: Route[] = [
  { method: "POST", path: "/api/chat", model: true },
  { method: "POST", path: "/api/generate", model: true },
  { method: "POST", path: "/api/embed", model: true },
  { method: "GET", path: "/api/tags", model: false },
  { method: "GET", path: "/api/ps", model: false },
];

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const token = (env.GATEWAY_TOKEN || "").trim();
  if (token.length < 32) throw new Error("GATEWAY_TOKEN must be set to a random value of at least 32 characters");
  const ollamaUrl = new URL(env.OLLAMA_URL || "http://127.0.0.1:11434").toString().replace(/\/+$/, "");
  const allowedModels = (env.GATEWAY_ALLOWED_MODELS || "qwen3.5:2b").split(",").map((model) => model.trim()).filter(Boolean);
  const number = (value: string | undefined, fallback: number, min: number, max: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.trunc(parsed))) : fallback;
  };
  return {
    ollamaUrl,
    token,
    allowedModels,
    maxConcurrent: number(env.GATEWAY_MAX_CONCURRENT, 1, 1, 8),
    queueLimit: number(env.GATEWAY_QUEUE_LIMIT, 8, 0, 100),
    timeoutMs: number(env.GATEWAY_TIMEOUT_MS, 300_000, 5_000, 900_000),
    maxBodyBytes: number(env.GATEWAY_MAX_BODY_BYTES, 20 * 1024 * 1024, 1024, 64 * 1024 * 1024),
    rateLimitPerMinute: number(env.GATEWAY_RATE_LIMIT_PER_MINUTE, 120, 1, 10_000),
  };
}

function send(res: ServerResponse, status: number, body: unknown) {
  if (res.headersSent) { res.end(); return; }
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(body));
}

function authorized(req: IncomingMessage, token: string) {
  const header = req.headers.authorization || "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const left = Buffer.from(supplied);
  const right = Buffer.from(token);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    total += (chunk as Buffer).length;
    if (total > limit) throw Object.assign(new Error("request body too large"), { status: 413 });
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/** Small FIFO semaphore: at most `max` active jobs, at most `queueLimit` waiting. */
export class Limiter {
  private active = 0;
  private waiting: Array<() => void> = [];
  constructor(private max: number, private queueLimit: number) {}
  get stats() { return { active: this.active, waiting: this.waiting.length }; }
  async acquire(signal: AbortSignal): Promise<() => void> {
    if (this.active < this.max) { this.active += 1; return () => this.release(); }
    if (this.waiting.length >= this.queueLimit) throw Object.assign(new Error("gateway is busy; try again shortly"), { status: 429 });
    await new Promise<void>((resolve, reject) => {
      const start = () => { signal.removeEventListener("abort", cancel); resolve(); };
      const cancel = () => { this.waiting = this.waiting.filter((item) => item !== start); reject(Object.assign(new Error("request cancelled"), { status: 499 })); };
      signal.addEventListener("abort", cancel, { once: true });
      this.waiting.push(start);
    });
    this.active += 1;
    return () => this.release();
  }
  private release() { this.active -= 1; this.waiting.shift()?.(); }
}

export function createGateway(config: GatewayConfig): Server {
  const limiter = new Limiter(config.maxConcurrent, config.queueLimit);
  const hits = new Map<string, { windowStart: number; count: number }>();

  return createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://gateway.local");
    const controller = new AbortController();
    res.on("close", () => { if (!res.writableFinished) controller.abort(); });

    // Public health check: says whether Ollama answers, never anything about prompts or models in use.
    if (req.method === "GET" && url.pathname === "/health") {
      try {
        const upstream = await fetch(`${config.ollamaUrl}/api/version`, { signal: AbortSignal.timeout(3_000) });
        return send(res, upstream.ok ? 200 : 502, { status: upstream.ok ? "ok" : "ollama_unavailable", queue: limiter.stats });
      } catch { return send(res, 502, { status: "ollama_unavailable", queue: limiter.stats }); }
    }

    const route = ROUTES.find((candidate) => candidate.method === req.method && candidate.path === url.pathname);
    if (!route) return send(res, 404, { error: "not found" });
    if (!authorized(req, config.token)) return send(res, 401, { error: "invalid gateway token" });

    const ip = (req.socket.remoteAddress || "unknown").slice(0, 64);
    const now = Date.now();
    const bucket = hits.get(ip);
    if (!bucket || now - bucket.windowStart >= 60_000) hits.set(ip, { windowStart: now, count: 1 });
    else if (++bucket.count > config.rateLimitPerMinute) return send(res, 429, { error: "rate limit exceeded" });
    if (hits.size > 10_000) hits.clear();

    let body: Buffer | undefined;
    try {
      if (req.method === "POST") {
        body = await readBody(req, config.maxBodyBytes);
        let parsed: { model?: unknown };
        try { parsed = JSON.parse(body.toString("utf8")) as { model?: unknown }; } catch { return send(res, 400, { error: "body must be JSON" }); }
        if (route.model && (typeof parsed.model !== "string" || !config.allowedModels.includes(parsed.model))) {
          return send(res, 403, { error: "model is not allowed on this gateway", allowed: config.allowedModels });
        }
      }
    } catch (error) {
      return send(res, (error as { status?: number }).status ?? 400, { error: (error as Error).message });
    }

    let release: (() => void) | undefined;
    try {
      // Listing endpoints are cheap and are used for health checks, so they skip the inference queue.
      if (route.model) release = await limiter.acquire(controller.signal);
      const upstream = await fetch(`${config.ollamaUrl}${route.path}`, {
        method: route.method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? new Uint8Array(body) : undefined,
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(config.timeoutMs)]),
      });
      res.writeHead(upstream.status, { "content-type": upstream.headers.get("content-type") || "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" });
      if (upstream.body) {
        const reader = upstream.body.getReader();
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          if (!res.write(chunk.value)) await new Promise((resolve) => res.once("drain", resolve));
        }
      }
      res.end();
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (controller.signal.aborted && !status) { res.destroy(); return; }
      const timedOut = (error as Error).name === "TimeoutError";
      send(res, status ?? (timedOut ? 504 : 502), { error: status ? (error as Error).message : timedOut ? "Ollama took too long to answer" : "Ollama is not reachable from the gateway" });
    } finally {
      release?.();
    }
  });
}
