import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { db, toolApprovals, workspaceMembers } from "@bobai/db";
import { getTool, validateToolInput, type BobTool, type ToolPermission } from "./toolRegistry.js";
import { recordAudit } from "./audit.js";
import { toolProviderConfigured as providerConfigured } from "./toolProviders.js";

export type ToolExecutionContext = { userId: string; workspaceId: string; approvalToken?: string; permission?: ToolPermission; arguments?: unknown };
export type ToolExecutionResult = { status: "ready"; tool: BobTool } | { status: "approval_required"; tool: BobTool } | { status: "unauthorized"; tool: BobTool } | { status: "invalid_arguments"; tool: BobTool; reason: string } | { status: "unavailable"; tool: BobTool; reason: string };
const APPROVAL_TTL_MS = 2 * 60_000; const MAX_APPROVAL_TOKEN_LENGTH = 256; const hashApprovalToken = (token: string) => createHash("sha256").update(token).digest("hex");
type Member = { id: string; role: string; permissions: unknown };
async function member(userId: string, workspaceId: string): Promise<Member | null> { const [row] = await db.select({ id: workspaceMembers.id, role: workspaceMembers.role, permissions: workspaceMembers.permissions }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId))).limit(1); return row ?? null; }
function permissionAllowed(member: Member, permission: ToolPermission) { if (member.role === "owner" || member.role === "admin") return true; if (permission === "read") return true; const raw = member.permissions; if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false; const value = raw as Record<string, unknown>; const allowed = value.tools; if (!Array.isArray(allowed)) return false; return allowed.some((item) => item === permission || item === "*" || (typeof item === "string" && item.startsWith(`${permission}:`))); }
export async function issueToolApproval(toolId: string, userId: string, workspaceId: string) { const tool = getTool(toolId); const current = await member(userId, workspaceId); if (!tool || !current || !permissionAllowed(current, tool.permission) || !tool.requiresUserApproval || process.env.BOBAI_TOOLS_ENABLED === "false") return null; const token = randomBytes(32).toString("base64url"); const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS); await db.insert(toolApprovals).values({ userId, workspaceId, kind: "tool", toolId: tool.id, targetName: tool.name, tokenHash: hashApprovalToken(token), expiresAt }); await recordAudit({ action: "tool_approval_issued", resourceType: "tool_approval", userId, workspaceId, metadata: { toolId } }); return { token, expiresIn: APPROVAL_TTL_MS / 1000 }; }
async function consumeApproval(token: string | undefined, toolId: string, userId: string, workspaceId: string) { if (!token || token.length > MAX_APPROVAL_TOKEN_LENGTH) return false; const now = new Date(); const [grant] = await db.update(toolApprovals).set({ consumedAt: now }).where(and(eq(toolApprovals.tokenHash, hashApprovalToken(token)), eq(toolApprovals.kind, "tool"), eq(toolApprovals.userId, userId), eq(toolApprovals.workspaceId, workspaceId), eq(toolApprovals.toolId, toolId), isNull(toolApprovals.consumedAt), gt(toolApprovals.expiresAt, now))).returning({ id: toolApprovals.id }); if (grant) await recordAudit({ action: "tool_approval_consumed", resourceType: "tool_approval", resourceId: grant.id, userId, workspaceId, metadata: { toolId } }); return Boolean(grant); }
export async function prepareToolExecution(toolId: string, context: ToolExecutionContext): Promise<ToolExecutionResult> { const tool = getTool(toolId); if (!tool) throw new Error("tool not found"); if (process.env.BOBAI_TOOLS_ENABLED === "false") return { status: "unavailable", tool, reason: "tool execution is disabled" }; const workspaceId = context.workspaceId.trim(); if (!workspaceId) return { status: "unauthorized", tool }; const current = await member(context.userId, workspaceId); if (!current || !permissionAllowed(current, tool.permission)) return { status: "unauthorized", tool }; if (context.permission && context.permission !== tool.permission) return { status: "unauthorized", tool }; const inputError = validateToolInput(tool, context.arguments ?? {}); if (inputError) return { status: "invalid_arguments", tool, reason: inputError }; if (!providerConfigured(tool.id)) return { status: "unavailable", tool, reason: "provider is not configured" }; if (tool.requiresUserApproval && !await consumeApproval(context.approvalToken, tool.id, context.userId, workspaceId)) return { status: "approval_required", tool }; return { status: "ready", tool }; }
export async function cleanupExpiredToolApprovals() { await db.delete(toolApprovals).where(lt(toolApprovals.expiresAt, new Date())); }

export async function fetchWeatherData(cityInput: string, signal?: AbortSignal) {
  const city = cityInput.trim().replace(/\s+/g, " ");
  if (!city || city.length > 120) throw new Error("weather requires a city name");
  const timeout = signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000);

  // Open-Meteo's global geocoder supports cities worldwide. Ask for multiple matches instead of
  // trusting the first population-ranked result, then prefer an exact place-name match.
  const geoUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  geoUrl.searchParams.set("name", city);
  geoUrl.searchParams.set("count", "10");
  geoUrl.searchParams.set("language", "en");
  geoUrl.searchParams.set("format", "json");
  const geoResponse = await fetch(geoUrl, { signal: timeout, redirect: "error", headers: { accept: "application/json" } });
  if (!geoResponse.ok) throw new Error("weather location lookup failed");
  const geo = await geoResponse.json() as { results?: Array<{ name?: string; country?: string; latitude?: number; longitude?: number; timezone?: string; admin1?: string }> };
  const results = geo.results ?? [];
  const requestedName = city.split(",")[0].trim().toLocaleLowerCase();
  let place = results.find((result) => result.name?.trim().toLocaleLowerCase() === requestedName) ?? (/\bbachupally\b/i.test(city) ? undefined : results[0]);

  // Bachupally is a Hyderabad locality and may not appear as a standalone city in global gazetteers.
  // Use its locality coordinates rather than failing or silently reporting an unrelated city.
  if (!place && /\bbachupally\b/i.test(city)) {
    place = { name: "Bachupally", admin1: "Telangana", country: "India", latitude: 17.544887, longitude: 78.359975, timezone: "Asia/Kolkata" };
  }
  if (!place || typeof place.latitude !== "number" || typeof place.longitude !== "number") {
    throw new Error("could not find that city for live weather");
  }

  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.searchParams.set("latitude", String(place.latitude));
  forecastUrl.searchParams.set("longitude", String(place.longitude));
  forecastUrl.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m");
  forecastUrl.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max");
  forecastUrl.searchParams.set("forecast_days", "1");
  forecastUrl.searchParams.set("timezone", place.timezone || "auto");
  const response = await fetch(forecastUrl, { signal: timeout, redirect: "error", headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("live weather provider is unavailable");
  const data = await response.json() as { current?: Record<string, unknown>; current_units?: Record<string, string>; daily?: Record<string, unknown>; daily_units?: Record<string, string> };
  if (!data.current) throw new Error("live weather provider returned no current conditions");
  const highs = data.daily?.temperature_2m_max;
  const lows = data.daily?.temperature_2m_min;
  const precipitationProbabilities = data.daily?.precipitation_probability_max;
  const code = Number(data.current.weather_code);
  const conditions: Record<number, string> = { 0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle", 56: "Freezing drizzle", 57: "Heavy freezing drizzle", 61: "Light rain", 63: "Moderate rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Heavy freezing rain", 71: "Light snow", 73: "Moderate snow", 75: "Heavy snow", 77: "Snow grains", 80: "Light rain showers", 81: "Moderate rain showers", 82: "Violent rain showers", 85: "Snow showers", 86: "Heavy snow showers", 95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with heavy hail" };
  return {
    location: [place.name, place.admin1, place.country].filter(Boolean).join(", "),
    timezone: place.timezone || "local timezone",
    observedAt: data.current.time,
    current: {
      condition: conditions[code] || "Unknown conditions",
      temperature: data.current.temperature_2m,
      temperatureUnit: data.current_units?.temperature_2m,
      feelsLike: data.current.apparent_temperature,
      humidity: data.current.relative_humidity_2m,
      humidityUnit: data.current_units?.relative_humidity_2m,
      windSpeed: data.current.wind_speed_10m,
      windSpeedUnit: data.current_units?.wind_speed_10m,
      precipitation: data.current.precipitation,
      precipitationUnit: data.current_units?.precipitation,
    },
    today: {
      high: Array.isArray(highs) ? highs[0] : undefined,
      low: Array.isArray(lows) ? lows[0] : undefined,
      precipitationProbabilityMax: Array.isArray(precipitationProbabilities) ? precipitationProbabilities[0] : undefined,
    },
    source: "Open-Meteo",
    sourceUrl: "https://open-meteo.com/",
  };
}

