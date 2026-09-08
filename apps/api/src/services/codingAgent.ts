import { parseToolResult } from "./structuredResult.js";

const DEFAULT_URL = "http://127.0.0.1:3456";
const MAX_TASK_LENGTH = 20_000;
const POLL_MS = 1_000;
const TIMEOUT_MS = 5 * 60 * 1_000;
const REQUEST_TIMEOUT_MS = 15_000;

type CodingAgentJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  result?: { plan?: unknown; executionResults?: string[]; review?: string };
  error?: string;
};

export function isCodingTask(text: string) {
  return /\b(write|build|create|fix|debug|refactor|implement|code|coding|program|function|component|api|endpoint|typescript|javascript|python|react|next\.js|css|html)\b/i.test(text);
}

function getConfig() {
  const url = (process.env.BOBAI_CODING_AGENT_URL || DEFAULT_URL).replace(/\/$/, "");
  const key = process.env.BOBAI_CODING_AGENT_KEY?.trim();
  if (!key || key.length < 32) throw new Error("coding agent bridge is not configured");

  if (process.env.NODE_ENV === "production" && process.env.BOBAI_CODING_AGENT_SANDBOX_ATTESTED !== "true") {
    throw new Error("coding agent sandbox is not production-attested");
  }

  const parsed = new URL(url);
  if (!parsed.port) parsed.port = "3456";
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname.toLowerCase())) {
    throw new Error("coding agent bridge must run on localhost");
  }

  return { url: parsed.toString().replace(/\/$/, ""), key };
}

async function request<T>(url: string, key: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...init?.headers },
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string" ? body.error : `coding agent returned ${response.status}`;
      throw new Error(message);
    }
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeCompletedResult(result: unknown) {
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("coding agent returned an invalid result");
  const value = result as Record<string, unknown>;
  if (value.plan !== undefined && typeof value.plan !== "string" && (typeof value.plan !== "object" || value.plan === null)) throw new Error("coding agent returned an invalid plan");
  if (value.executionResults !== undefined && (!Array.isArray(value.executionResults) || value.executionResults.some((item) => typeof item !== "string" || item.length > 20_000))) throw new Error("coding agent returned invalid execution results");
  if (value.review !== undefined && (typeof value.review !== "string" || value.review.length > 20_000)) throw new Error("coding agent returned an invalid review");
  return value;
}

export async function runCodingAgent(task: string) {
  const normalizedTask = task.trim();
  if (!normalizedTask) throw new Error("coding task is empty");
  if (normalizedTask.length > MAX_TASK_LENGTH) throw new Error(`coding task cannot exceed ${MAX_TASK_LENGTH} characters`);

  const { url, key } = getConfig();
  const created = await request<{ id: string; status: CodingAgentJob["status"] }>(`${url}/task`, key, {
    method: "POST",
    body: JSON.stringify({ prompt: normalizedTask }),
  });
  if (!created.id || created.id.length > 256) throw new Error("coding agent returned an invalid task id");

  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    const job = await request<CodingAgentJob>(`${url}/task/${encodeURIComponent(created.id)}`, key);
    if (!["queued", "running", "completed", "failed", "cancelled"].includes(job.status)) throw new Error("coding agent returned an invalid status");
    if (job.status === "completed") {
      const result = normalizeCompletedResult(job.result ?? {});
      const structured = parseToolResult({ ok: true, data: result, meta: { provider: "coding-agent" } });
      if (!structured) throw new Error("coding agent returned an invalid structured result");
      return { output: JSON.stringify(result), warnings: typeof result.review === "string" ? result.review : "" };
    }
    if (job.status === "failed") throw new Error(typeof job.error === "string" && job.error.length <= 4_000 ? job.error : "coding agent failed");
    if (job.status === "cancelled") throw new Error("coding agent task was cancelled");
  }

  throw new Error("coding agent timed out after 5 minutes");
}
