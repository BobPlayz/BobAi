const baseUrl = (process.env.BOBAI_SMOKE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "");

async function check(path: string, expected: number[]) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  const body = await response.text();
  if (!expected.includes(response.status)) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return { path, status: response.status, body: body.slice(0, 200) };
}

const results = await Promise.all([
  check("/health", [200]),
  check("/v1/health", [200]),
  check("/v1/conversations", [401, 403]),
]);

console.log(JSON.stringify({ ok: true, baseUrl, checks: results.map(({ path, status }) => ({ path, status })) }));
