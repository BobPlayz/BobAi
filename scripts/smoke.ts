const baseUrl = (process.env.BOBAI_SMOKE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "");
const TIMEOUT_MS = 10_000;

async function check(path: string, expected: number[]) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}${path}`, { redirect: "error", signal: controller.signal });
    if (!expected.includes(response.status)) throw new Error(`${path} returned ${response.status}`);
    return { path, status: response.status };
  } finally {
    clearTimeout(timer);
  }
}

const results = await Promise.all([
  check("/health", [200]),
  check("/v1/health", [200]),
  check("/v1/conversations", [401, 403]),
]);

console.log(JSON.stringify({ ok: true, baseUrl, checks: results }));
