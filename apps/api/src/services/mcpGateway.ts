import { randomUUID } from "node:crypto";

export type McpServerConfig = { id: string; name: string; url: string };
export type McpTool = { name: string; description?: string; inputSchema?: unknown; serverId: string; serverName: string };

const MAX_SERVERS = 20;
const MAX_TOOLS_PER_SERVER = 100;
const REQUEST_TIMEOUT_MS = 15_000;

function configuredServers(): McpServerConfig[] {
  const raw = process.env.BOBAI_MCP_SERVERS?.trim();
  if (!raw) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("BOBAI_MCP_SERVERS must be valid JSON"); }
  if (!Array.isArray(parsed)) throw new Error("BOBAI_MCP_SERVERS must be a JSON array");
  return parsed.slice(0, MAX_SERVERS).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const value = item as Record<string, unknown>;
    const id = typeof value.id === "string" ? value.id.trim() : "";
    const name = typeof value.name === "string" ? value.name.trim() : id;
    const url = typeof value.url === "string" ? value.url.trim() : "";
    if (!id || !url) return [];
    try {
      const parsedUrl = new URL(url);
      const loopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsedUrl.hostname.toLowerCase());
      if (parsedUrl.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && parsedUrl.protocol === "http:" && loopback)) return [];
      return [{ id, name: name || id, url: parsedUrl.toString().replace(/\/$/, "") }];
    } catch { return []; }
  });
}

async function call(server: McpServerConfig, method: string, params: Record<string, unknown> = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(server.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "MCP-Protocol-Version": "2026-07-28",
        "Mcp-Method": method,
        "Mcp-Name": method,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: randomUUID(), method, params }),
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) throw new Error(`MCP server returned ${response.status}`);
    return await response.json() as Record<string, unknown>;
  } finally { clearTimeout(timer); }
}

export function listConfiguredMcpServers(): McpServerConfig[] { return configuredServers().map((server) => ({ ...server })); }

export async function discoverMcpTools(): Promise<McpTool[]> {
  const tools: McpTool[] = [];
  for (const server of configuredServers()) {
    try {
      const response = await call(server, "tools/list");
      const result = response.result as Record<string, unknown> | undefined;
      const values = Array.isArray(result?.tools) ? result.tools : [];
      for (const item of values.slice(0, MAX_TOOLS_PER_SERVER)) {
        if (!item || typeof item !== "object") continue;
        const value = item as Record<string, unknown>;
        if (typeof value.name !== "string" || !value.name.trim()) continue;
        tools.push({
          name: value.name.trim(),
          description: typeof value.description === "string" ? value.description.slice(0, 2_000) : undefined,
          inputSchema: value.inputSchema,
          serverId: server.id,
          serverName: server.name,
        });
      }
    } catch {
      // One unavailable MCP server must not hide tools from other servers.
    }
  }
  return tools;
}
