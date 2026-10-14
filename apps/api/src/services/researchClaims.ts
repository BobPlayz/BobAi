import { and, eq } from "drizzle-orm";
import { db, researchClaims, researchSessions } from "@bobai/db";
import { randomUUID } from "node:crypto";
export type ClaimInput = { claim: string; sourceIndexes: number[]; confidence?: number };
function tokens(value: string) { return new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 3)); }
function overlap(a: string, b: string) { const aa = tokens(a), bb = tokens(b); if (!aa.size || !bb.size) return 0; let hit = 0; for (const t of aa) if (bb.has(t)) hit++; return hit / Math.max(aa.size, bb.size); }
function polarity(value: string) { const neg = /\b(no|not|never|without|cannot|can't|didn't|doesn't|isn't|aren't)\b/i.test(value); const numbers = [...value.matchAll(/\b\d+(?:\.\d+)?\b/g)].map((m) => Number(m[0])); return { neg, numbers }; }
function contradiction(a: string, b: string) { if (overlap(a, b) < 0.45) return null; const pa = polarity(a), pb = polarity(b); if (pa.neg !== pb.neg) return "claims have opposing polarity"; if (pa.numbers.length && pb.numbers.length && pa.numbers.some((n) => pb.numbers.some((m) => n !== m))) return "claims contain conflicting numeric values"; return null; }
export async function saveResearchClaims(sessionId: string, userId: string, claims: ClaimInput[]) {
  if (!Array.isArray(claims) || claims.length > 200) throw new Error("too many research claims");
  const [session] = await db.select({ id: researchSessions.id, sources: researchSessions.sources }).from(researchSessions).where(and(eq(researchSessions.id, sessionId), eq(researchSessions.userId, userId))).limit(1);
  if (!session) throw new Error("research session not found");
  const existing = await listResearchClaims(sessionId, userId);
  const sources = Array.isArray(session.sources) ? session.sources as Array<Record<string, unknown>> : [];
  const normalized: Array<{ id: string; sessionId: string; userId: string; claim: string; sourceIndexes: number[]; confidence: number; contradiction?: string }> = [];
  for (const item of claims as unknown[]) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("each research claim must be an object");
    const value = item as Record<string, unknown>;
    const claim = typeof value.claim === "string" ? value.claim.trim().slice(0, 2_000) : "";
    const indexes = Array.isArray(value.sourceIndexes)
      ? [...new Set(value.sourceIndexes.filter((index): index is number => Number.isInteger(index) && index >= 1 && index <= sources.length))]
      : [];
    if (!claim || !indexes.length) throw new Error("each claim requires text and at least one valid source");
    if (value.confidence !== undefined && (typeof value.confidence !== "number" || !Number.isFinite(value.confidence))) throw new Error("claim confidence must be a finite number");
    const sourceText = indexes.map((index) => {
      const source = sources[index - 1] || {};
      return `${String(source.title || "")} ${String(source.snippet || "")}`;
    }).join(" ");
    const prior = [...existing, ...normalized];
    const conflict = prior.map((other) => contradiction(claim, other.claim)).find(Boolean);
    normalized.push({
      id: randomUUID(),
      sessionId,
      userId,
      claim,
      sourceIndexes: indexes,
      confidence: Math.min(100, Math.max(0, Math.floor(value.confidence === undefined ? overlap(claim, sourceText) * 100 : value.confidence))),
      ...(conflict ? { contradiction: conflict } : {}),
    });
  }
  if (normalized.length) await db.transaction(async (tx) => {
    for (const claim of normalized) await tx.insert(researchClaims).values(claim);
  });
  return normalized;
}
export async function listResearchClaims(sessionId: string, userId: string) { return db.select().from(researchClaims).where(and(eq(researchClaims.sessionId, sessionId), eq(researchClaims.userId, userId))); }
