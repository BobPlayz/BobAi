const DEFAULT_URL = "http://127.0.0.1:3456";
const MAX_TASK_LENGTH = 20_000;
const POLL_MS = 1_000;
const TIMEOUT_MS = 5 * 60 * 1_000;

type CodingAgentJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  result?: {
    plan?: unknown;
    executionResults?: string[];
    review?: string;
  };
  error?: string;
};

export function isCodingTask(text: string) {
  return /\b(write|build|create|fix|debug|refactor|implement|code|coding|program|function|component|api|endpoint|typescript|javascript|python|react|next\.js|css|html)\b/i.test(text);
}

function getConfig() {
  const url = (process.env.BOBAI_CODING_AGENT_URL || DEFAULT_URL).replace(/\/$/, "");
  const key = process.env.BOBAI_CODING_AGENT_KEY?.trim();

  if (!key || key.length < 32) throw new Error("coding agent bridge is not configured");
  return { url, key };
}

async function request<T>(url: string, key: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...init?.headers }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : `coding agent returned ${response.status}`);
  return body as T;
}

export async function runCodingAgent(task: string) {
  const normalizedTask = task.trim();
  if (!normalizedTask) throw new Error("coding task is empty");
  if (normalizedTask.length > MAX_TASK_LENGTH) throw new Error(`coding task cannot exceed ${MAX_TASK_LENGTH} characters`);

  const { url, key } = getConfig();
  const created = await request<{ id: string; status: CodingAgentJob["status"] }>(`${url}/task`, key, {
    method: "POST",
    body: JSON.stringify({ prompt: normalizedTask })
  });

  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    const job = await request<CodingAgentJob>(`${url}/task/${encodeURIComponent(created.id)}`, key);
    if (job.status === "completed") {
      return {
        output: JSON.stringify(job.result ?? {}),
        warnings: typeof job.result?.review === "string" ? job.result.review : ""
      };
    }
    if (job.status === "failed") throw new Error(job.error || "coding agent failed");
    if (job.status === "cancelled") throw new Error("coding agent task was cancelled");
  }

  throw new Error("coding agent timed out after 5 minutes");
}
