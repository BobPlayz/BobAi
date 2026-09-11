import { and, asc, eq } from "drizzle-orm";
import { db, agentArtifacts } from "@bobai/db";
import { randomUUID } from "node:crypto";
export async function persistAgentArtifact(input: { taskId: string; workspaceId: string; createdBy?: string; stepId: string; kind: string; content: unknown }) { const encoded = JSON.stringify(input.content); if (encoded.length > 2 * 1024 * 1024) throw new Error("agent artifact exceeds the 2 MB limit"); const id = randomUUID(); await db.insert(agentArtifacts).values({ id, taskId: input.taskId, workspaceId: input.workspaceId, createdBy: input.createdBy, stepId: input.stepId.slice(0, 80), kind: input.kind.slice(0, 80), content: input.content }); return id; }
export async function listAgentArtifacts(taskId: string, userId: string) { return db.select().from(agentArtifacts).where(and(eq(agentArtifacts.taskId, taskId), eq(agentArtifacts.createdBy, userId))).orderBy(asc(agentArtifacts.createdAt)).limit(200); }
