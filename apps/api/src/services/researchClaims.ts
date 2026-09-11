import { and, eq } from "drizzle-orm";
import { db, researchClaims, researchSessions } from "@bobai/db";
import { randomUUID } from "node:crypto";
export type ClaimInput = { claim: string; sourceIndexes: number[]; confidence?: number };
function tokens(value: string) { return new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 3)); }
function overlap(a: string, b: string) { const aa = tokens(a), bb = tokens(b); if (!aa.size || !bb.size) return 0; let hit = 0; for (const t of aa) if (bb.has(t)) hit++; return hit / Math.max(aa.size, bb.size); }
export async function saveResearchClaims(sessionId: string, userId: string, claims: ClaimInput[]) {
  const [session] = await db.select({ id: researchSessions.id, sources: researchSessions.sources }).from(researchSessions).where(and(eq(researchSessions.id, sessionId), eq(researchSessions.userId, userId))).limit(1);
  if (!session) throw new Error("research session not found"); if (!Array.isArray(claims) || claims.length > 200) throw new Error("too many research claims");
  const sources = Array.isArray(session.sources) ? session.sources as Array<Record<string, unknown>> : [];
  const normalized = claims.map((item) => { const claim = typeof item.claim === "string" ? item.claim.trim().slice(0, 2_000) : ""; const indexes = Array.isArray(item.sourceIndexes) ? [...new Set(item.sourceIndexes.filter((x) => Number.isInteger(x) && x >= 1 && x <= sources.length))] : []; if (!claim || !indexes.length) throw new Error("each claim requires at least one valid source"); const sourceText = indexes.map((i) => { const s = sources[i - 1] || {}; return `${String(s.title || "")} ${String(s.snippet || "")}`; }).join(" "); return { id: randomUUID(), sessionId, userId, claim, sourceIndexes: indexes, confidence: Math.min(100, Math.max(0, Math.floor(item.confidence ?? overlap(claim, sourceText) * 100))), contradiction: undefined }; });
  for (const claim of normalized) await db.insert(researchClaims).values(claim); return normalized;
}
export async function listResearchClaims(sessionId: string, userId: string) { return db.select().from(researchClaims).where(and(eq(researchClaims.sessionId, sessionId), eq(researchClaims.userId, userId))); }
