import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { and, eq, isNull } from "drizzle-orm";
import { db, integrations } from "@bobai/db";

export type RegisteredMcpServer = { id: string; name: string; url: string; scopes: string[] };

const MAX_SERVERS_PER_WORKSPACE = 20;
const MAX_NAME_LENGTH = 120;
const MAX_SCOPE_LENGTH = 200;
const MAX_SCOPES = 100;
const ALLOWED_PROTOCOL = "https:";

function ipv4IsPrivate(value: string) {
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168)) || (a === 198 && b >= 18 && b <= 19) || (a === 203 && b === 0) || a >= 224;
}

function ipv6IsPrivate(value: string) {
  const normalized = value.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") || normalized.startsWith("ff")) return true;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? ipv4IsPrivate(mapped[1]) : false;
}

export async function validateMcpUrl(rawUrl: string) {
  const url = new URL(rawUrl.trim());
  if (url.protocol !== ALLOWED_PROTOCOL && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname.toLowerCase()))) throw new Error("MCP server URL must use HTTPS");
  if (url.username || url.password) throw new Error("MCP server URL must not contain credentials");
  if (url.hash) throw new Error("MCP server URL must not contain a fragment");
  if (url.port && !["443", "8443"].includes(url.port)) throw new Error("MCP server port is not allowed");
  const host = url.hostname.toLowerCase();
  const localHost = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
  if (localHost) return url.toString().replace(/\/$/, "");
  const ipVersion = isIP(host.replace(/^\[|\]$/g, ""));
  if (ipVersion === 4 && ipv4IsPrivate(host)) throw new Error("MCP server must resolve to a public address");
  if (ipVersion === 6 && ipv6IsPrivate(host)) throw new Error("MCP server must resolve to a public address");
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => entry.address.includes(":" ) ? ipv6IsPrivate(entry.address) : ipv4IsPrivate(entry.address))) throw new Error("MCP server must resolve only to public addresses");
  return url.toString().replace(/\/$/, "");
}

function normalizeScopes(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter((item) => item && item.length <= MAX_SCOPE_LENGTH && /^[A-Za-z0-9:_.*-]+$/.test(item)).slice(0, MAX_SCOPES))];
}

function fromRow(row: typeof integrations.$inferSelect): RegisteredMcpServer | null {
  const configuration = row.configuration && typeof row.configuration === "object" && !Array.isArray(row.configuration) ? row.configuration as Record<string, unknown> : {};
  const url = typeof configuration.url === "string" ? configuration.url : "";
  const name = typeof row.displayName === "string" && row.displayName.trim() ? row.displayName.trim() : "MCP server";
  if (!url) return null;
  return { id: row.id, name, url, scopes: normalizeScopes(row.scopes) };
}

export async function listRegisteredMcpServers(workspaceId: string) {
  const rows = await db.select().from(integrations).where(and(eq(integrations.workspaceId, workspaceId), eq(integrations.provider, "mcp"), eq(integrations.isEnabled, true), isNull(integrations.deletedAt)));
  return rows.flatMap((row) => { const value = fromRow(row); return value ? [value] : []; }).slice(0, MAX_SERVERS_PER_WORKSPACE);
}

export async function registerMcpServer(input: { workspaceId: string; userId: string; name: string; url: string; scopes?: unknown }) {
  const name = input.name.trim();
  if (!name || name.length > MAX_NAME_LENGTH) throw new Error("invalid MCP server name");
  const url = await validateMcpUrl(input.url);
  const scopes = normalizeScopes(input.scopes);
  const existing = await listRegisteredMcpServers(input.workspaceId);
  if (existing.length >= MAX_SERVERS_PER_WORKSPACE) throw new Error("MCP server limit reached");
  const [row] = await db.insert(integrations).values({ workspaceId: input.workspaceId, createdBy: input.userId, provider: "mcp", displayName: name, scopes, configuration: { url }, isEnabled: true }).returning();
  if (!row) throw new Error("MCP server registration failed");
  return fromRow(row)!;
}

export async function updateMcpServer(input: { workspaceId: string; userId: string; id: string; name?: string; url?: string; scopes?: unknown; isEnabled?: boolean }) {
  const [existing] = await db.select().from(integrations).where(and(eq(integrations.id, input.id), eq(integrations.workspaceId, input.workspaceId), eq(integrations.provider, "mcp"), eq(integrations.createdBy, input.userId), isNull(integrations.deletedAt))).limit(1);
  if (!existing) throw new Error("MCP server not found");
  const current = fromRow(existing);
  if (!current) throw new Error("MCP server configuration invalid");
  const name = input.name === undefined ? current.name : input.name.trim();
  if (!name || name.length > MAX_NAME_LENGTH) throw new Error("invalid MCP server name");
  const url = input.url === undefined ? current.url : await validateMcpUrl(input.url);
  const scopes = input.scopes === undefined ? current.scopes : normalizeScopes(input.scopes);
  const [row] = await db.update(integrations).set({ displayName: name, scopes, configuration: { url }, isEnabled: input.isEnabled ?? existing.isEnabled, updatedAt: new Date() }).where(and(eq(integrations.id, input.id), eq(integrations.workspaceId, input.workspaceId), eq(integrations.provider, "mcp"), eq(integrations.createdBy, input.userId), isNull(integrations.deletedAt))).returning();
  if (!row) throw new Error("MCP server update failed");
  return fromRow(row)!;
}

export async function removeMcpServer(input: { workspaceId: string; userId: string; id: string }) {
  const [row] = await db.update(integrations).set({ isEnabled: false, deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(integrations.id, input.id), eq(integrations.workspaceId, input.workspaceId), eq(integrations.provider, "mcp"), eq(integrations.createdBy, input.userId), isNull(integrations.deletedAt))).returning({ id: integrations.id });
  if (!row) throw new Error("MCP server not found");
  return { success: true };
}

export function mcpScopeAllows(scopes: string[], toolName: string) {
  return scopes.includes("*") || scopes.includes(toolName) || scopes.includes(`tool:${toolName}`);
}
