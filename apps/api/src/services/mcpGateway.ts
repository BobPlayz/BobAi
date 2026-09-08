import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, toolApprovals } from "@bobai/db";
import { recordAudit } from "./audit.js";

export type McpServerConfig = { id: string; name: string; url: string };
export type McpTool = { name: string; description?: string; inputSchema?: unknown; serverId: string; serverName: string };

const MAX_SERVERS = 20;
const MAX_TOOLS_PER_SERVER = 100;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_MCP_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAX_MCP_ARGUMENT_BYTES = 256 * 1024;
const APPROVAL_TTL_MS = 5 * 60_000;
const hashApprovalToken = (token: string) => createHash("sha256").update(token).digest("hex");

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
      headers: { "content-type": "application/json", "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": method, "Mcp-Name": method },
      body: JSON.stringify({ jsonrpc: "2.0", id: randomBytes(16).toString("hex"), method, params }),
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) throw new Error(`MCP server returned ${response.status}`);
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_MCP_RESPONSE_BYTES) throw new Error("MCP response exceeds the 10 MB limit");
    const text = await response.text();
    if (text.length > MAX_MCP_RESPONSE_BYTES) throw new Error("MCP response exceeds the 10 MB limit");
    return JSON.parse(text) as Record<string, unknown>;
  } finally { clearTimeout(timer); }
}

function findServer(serverId: string) { return configuredServers().find((server) => server.id === serverId); }
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
        tools.push({ name: value.name.trim(), description: typeof value.description === "string" ? value.description.slice(0, 2_000) : undefined, inputSchema: value.inputSchema, serverId: server.id, serverName: server.name });
      }
    } catch { /* isolate unavailable servers */ }
  }
  return tools;
}

export async function createMcpApproval(input: { userId: string; serverId: string; toolName: string }) {
  const server = findServer(input.serverId);
  if (!server) throw new Error("MCP server unavailable");
  if (!input.toolName || input.toolName.length > 200) throw new Error("invalid MCP tool");
  const discovered = await discoverMcpTools();
  if (!discovered.some((tool) => tool.serverId === input.serverId && tool.name === input.toolName)) throw new Error("MCP tool is not available");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS);
  await db.insert(toolApprovals).values({ userId: input.userId, kind: "mcp", serverId: input.serverId, targetName: input.toolName, tokenHash: hashApprovalToken(token), expiresAt });
  await recordAudit({ action: "mcp_approval_issued", resourceType: "mcp_approval", userId: input.userId, metadata: { serverId: input.serverId, toolName: input.toolName } });
  return { token, expiresAt: expiresAt.toISOString() };
}

async function consumeMcpApproval(input: { userId: string; approvalToken: string; serverId: string; toolName: string }) {
  const now = new Date();
  const [approval] = await db.update(toolApprovals).set({ consumedAt: now }).where(and(eq(toolApprovals.tokenHash, hashApprovalToken(input.approvalToken)), eq(toolApprovals.kind, "mcp"), eq(toolApprovals.userId, input.userId), eq(toolApprovals.serverId, input.serverId), eq(toolApprovals.targetName, input.toolName), isNull(toolApprovals.consumedAt), gt(toolApprovals.expiresAt, now))).returning({ id: toolApprovals.id });
  if (approval) await recordAudit({ action: "mcp_approval_consumed", resourceType: "mcp_approval", resourceId: approval.id, userId: input.userId, metadata: { serverId: input.serverId, toolName: input.toolName } });
  return Boolean(approval);
}

export async function executeApprovedMcpTool(input: { userId: string; approvalToken: string; serverId: string; toolName: string; arguments?: unknown }) {
  if (!await consumeMcpApproval(input)) throw new Error("MCP approval required");
  const server = findServer(input.serverId);
  if (!server) throw new Error("MCP server unavailable");
  const safeArguments = input.arguments && typeof input.arguments === "object" && !Array.isArray(input.arguments) ? input.arguments : {};
  const encodedArguments = JSON.stringify(safeArguments);
  if (encodedArguments.length > MAX_MCP_ARGUMENT_BYTES) throw new Error("MCP arguments exceed the 256 KB limit");
  const response = await call(server, "tools/call", { name: input.toolName, arguments: safeArguments });
  if (response.error) throw new Error("MCP tool execution failed");
  return response.result ?? null;
}
