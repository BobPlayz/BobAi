import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, toolApprovals } from "@bobai/db";
import { recordAudit } from "./audit.js";
import { listRegisteredMcpServers, mcpScopeAllows, validateMcpUrl, type RegisteredMcpServer } from "./mcpRegistry.js";

export type McpServerConfig = RegisteredMcpServer;
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
    const scopes = Array.isArray(value.scopes) ? value.scopes.filter((scope): scope is string => typeof scope === "string").map((scope) => scope.trim()).filter(Boolean).slice(0, 100) : ["*"];
    if (!id || !url || id.length > 100 || name.length > 200) return [];
    try {
      const parsedUrl = new URL(url);
      const loopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsedUrl.hostname.toLowerCase());
      if (parsedUrl.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && parsedUrl.protocol === "http:" && loopback)) return [];
      return [{ id, name: name || id, url: parsedUrl.toString().replace(/\/$/, ""), scopes }];
    } catch { return []; }
  });
}

async function allServers(workspaceId?: string) {
  const env = configuredServers();
  if (!workspaceId) return env;
  const registered = await listRegisteredMcpServers(workspaceId);
  const registeredIds = new Set(registered.map((server) => server.id));
  return [...env.filter((server) => !registeredIds.has(server.id)), ...registered].slice(0, MAX_SERVERS);
}

async function call(server: McpServerConfig, method: string, params: Record<string, unknown> = {}) {
  await validateMcpUrl(server.url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(server.url, {
      method: "POST",
      headers: { "content-type": "application/json", "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": method },
      body: JSON.stringify({ jsonrpc: "2.0", id: randomBytes(16).toString("hex"), method, params }),
      signal: controller.signal,
      redirect: "error"
    });
    if (!response.ok) throw new Error(`MCP server returned ${response.status}`);
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_MCP_RESPONSE_BYTES) throw new Error("MCP response exceeds the 10 MB limit");
    const text = await response.text();
    if (text.length > MAX_MCP_RESPONSE_BYTES) throw new Error("MCP response exceeds the 10 MB limit");
    return JSON.parse(text) as Record<string, unknown>;
  } finally { clearTimeout(timer); }
}

async function findServer(workspaceId: string, serverId: string) {
  return (await allServers(workspaceId)).find((server) => server.id === serverId);
}

export async function listConfiguredMcpServers(workspaceId: string) {
  return (await allServers(workspaceId)).map(({ id, name, scopes }) => ({ id, name, scopes }));
}

export async function discoverMcpTools(workspaceId: string): Promise<McpTool[]> {
  const tools: McpTool[] = [];
  for (const server of await allServers(workspaceId)) {
    try {
      const response = await call(server, "tools/list");
      const result = response.result as Record<string, unknown> | undefined;
      const values = Array.isArray(result?.tools) ? result.tools : [];
      for (const item of values.slice(0, MAX_TOOLS_PER_SERVER)) {
        if (!item || typeof item !== "object") continue;
        const value = item as Record<string, unknown>;
        if (typeof value.name !== "string" || !value.name.trim() || value.name.length > 200) continue;
        const name = value.name.trim();
        if (!mcpScopeAllows(server.scopes, name)) continue;
        tools.push({ name, description: typeof value.description === "string" ? value.description.slice(0, 2_000) : undefined, inputSchema: value.inputSchema, serverId: server.id, serverName: server.name });
      }
    } catch { /* isolate unavailable servers */ }
  }
  return tools;
}

export async function createMcpApproval(input: { userId: string; workspaceId: string; serverId: string; toolName: string }) {
  const server = await findServer(input.workspaceId, input.serverId);
  if (!server) throw new Error("MCP server unavailable");
  if (!input.toolName || input.toolName.length > 200 || !mcpScopeAllows(server.scopes, input.toolName)) throw new Error("MCP tool is not permitted");
  const discovered = await discoverMcpTools(input.workspaceId);
  if (!discovered.some((tool) => tool.serverId === input.serverId && tool.name === input.toolName)) throw new Error("MCP tool is not available");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS);
  await db.insert(toolApprovals).values({ userId: input.userId, workspaceId: input.workspaceId, kind: "mcp", serverId: input.serverId, targetName: input.toolName, tokenHash: hashApprovalToken(token), expiresAt });
  await recordAudit({ action: "mcp_approval_issued", resourceType: "mcp_approval", userId: input.userId, workspaceId: input.workspaceId, metadata: { serverId: input.serverId, toolName: input.toolName } });
  return { token, expiresAt: expiresAt.toISOString() };
}

async function consumeMcpApproval(input: { userId: string; workspaceId: string; approvalToken: string; serverId: string; toolName: string }) {
  const now = new Date();
  const [approval] = await db.update(toolApprovals).set({ consumedAt: now }).where(and(eq(toolApprovals.tokenHash, hashApprovalToken(input.approvalToken)), eq(toolApprovals.kind, "mcp"), eq(toolApprovals.userId, input.userId), eq(toolApprovals.workspaceId, input.workspaceId), eq(toolApprovals.serverId, input.serverId), eq(toolApprovals.targetName, input.toolName), isNull(toolApprovals.consumedAt), gt(toolApprovals.expiresAt, now))).returning({ id: toolApprovals.id });
  if (approval) await recordAudit({ action: "mcp_approval_consumed", resourceType: "mcp_approval", resourceId: approval.id, userId: input.userId, workspaceId: input.workspaceId, metadata: { serverId: input.serverId, toolName: input.toolName } });
  return Boolean(approval);
}

export async function executeApprovedMcpTool(input: { userId: string; workspaceId: string; approvalToken: string; serverId: string; toolName: string; arguments?: unknown }) {
  const server = await findServer(input.workspaceId, input.serverId);
  if (!server || !mcpScopeAllows(server.scopes, input.toolName)) throw new Error("MCP tool is not permitted");
  if (!await consumeMcpApproval(input)) throw new Error("MCP approval required");
  const safeArguments = input.arguments && typeof input.arguments === "object" && !Array.isArray(input.arguments) ? input.arguments : {};
  const encodedArguments = JSON.stringify(safeArguments);
  if (encodedArguments.length > MAX_MCP_ARGUMENT_BYTES) throw new Error("MCP arguments exceed the 256 KB limit");
  const response = await call(server, "tools/call", { name: input.toolName, arguments: safeArguments });
  if (response.error) throw new Error("MCP tool execution failed");
  return response.result ?? null;
}
