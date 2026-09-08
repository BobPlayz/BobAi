import { randomUUID } from "node:crypto";
import { Router } from "express";
import { initSSE } from "../utils/sse.js";
import { isCodingTask, runCodingAgent } from "../services/codingAgent.js";
import { prepareChat, runStream } from "../services/chatEngine.js";
import { dbRemember, dbRecallAll, isSensitiveMemory } from "../store/memoryDb.js";
import { dbSaveConversation } from "../store/conversationDb.js";
import { ensurePersonalWorkspace } from "../services/workspace.js";

const router = Router();
const STOP_WORDS = new Set(["the", "and", "that", "this", "with", "from", "what", "when", "where", "how", "why", "for", "are", "you", "about", "can", "could", "would", "please"]);

function relevantMemories(memories: Array<{ key: string; value: string }> | null, query: string) {
  if (!memories?.length) return [];
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2 && !STOP_WORDS.has(term));
  if (!terms.length) return memories.slice(0, 8).map((memory) => `${memory.key}: ${memory.value}`);
  return memories.map((memory) => {
    const text = `${memory.key} ${memory.value}`.toLowerCase();
    const score = terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
    return { memory, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 12).map((item) => `${item.memory.key}: ${item.memory.value}`);
}

router.post("/", async (req, res) => {
  const { send } = initSSE(res);
  const conversationId = typeof req.body?.conversationId === "string" && req.body.conversationId.trim() ? req.body.conversationId.trim() : randomUUID();

  try {
    const workspace = await ensurePersonalWorkspace(req.user!.id);
    const memoryEnabled = req.body?.memoryEnabled !== false;
    const latestText = Array.isArray(req.body?.messages) ? [...req.body.messages].reverse().find((message: any) => message?.role === "user")?.content || "" : "";
    const memories = memoryEnabled ? await dbRecallAll(workspace.id, req.user!.id) : [];
    const prepared = prepareChat({
      messages: req.body?.messages,
      personality: req.body?.personality,
      modelId: req.body?.modelId,
      memoryContext: relevantMemories(memories, typeof latestText === "string" ? latestText : ""),
    });

    if (prepared.validationError) { send("error", { message: prepared.validationError }); return res.end(); }

    if (prepared.memoryRequest && prepared.latestUserMessage) {
      if (!memoryEnabled) { send("done", { reply: "memory is off, so i won't save that.", title: prepared.title, memoryStored: false, conversationId }); return res.end(); }
      if (isSensitiveMemory(prepared.latestUserMessage.content)) { send("done", { reply: "i won't store passwords, codes, keys, or other sensitive secrets in memory.", title: prepared.title, memoryStored: false, conversationId }); return res.end(); }
      const stored = await dbRemember({ workspaceId: workspace.id, userId: req.user!.id, key: "explicit memory", value: prepared.latestUserMessage.content.trim() });
      if (!stored) { send("error", { message: "memory storage unavailable" }); return res.end(); }
      send("done", { reply: "got it. i will remember that for future conversations.", title: prepared.title, memoryStored: true, conversationId });
      return res.end();
    }

    if (prepared.latestUserMessage && isCodingTask(prepared.latestUserMessage.content) && process.env.BOBAI_CODING_AGENTS_DIR) {
      const result = await runCodingAgent(prepared.latestUserMessage.content);
      const reply = result.output || "the coding agent completed without output.";
      const persisted = await dbSaveConversation({ id: conversationId, userId: req.user!.id, workspaceId: workspace.id, title: prepared.title, messages: [...prepared.messages, { id: randomUUID(), role: "assistant", content: reply, model: "coding-agent", status: "completed" }] }).catch(() => false);
      send("done", { reply, title: prepared.title, agent: "coding", warnings: result.warnings, conversationId, persisted });
      return res.end();
    }

    let disconnected = false;
    const onClose = () => { disconnected = true; };
    req.once("close", onClose);
    try {
      const full = await runStream(prepared.ollamaMessages, (token) => { if (!disconnected && !res.writableEnded) send("token", { token }); }, prepared.modelId);
      const persisted = await dbSaveConversation({ id: conversationId, userId: req.user!.id, workspaceId: workspace.id, title: prepared.title, messages: [...prepared.messages, { id: randomUUID(), role: "assistant", content: full, model: prepared.modelId || process.env.OLLAMA_DEFAULT_MODEL || "qwen-3b", status: "completed" }] }).catch(() => false);
      if (disconnected || res.writableEnded) return;
      send("done", { reply: full, title: prepared.title, model: prepared.modelId || process.env.OLLAMA_DEFAULT_MODEL || "qwen-3b", conversationId, persisted });
      return res.end();
    } finally {
      req.off("close", onClose);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("STREAM ROUTE ERROR:", error);
    if (!res.writableEnded) { send("error", { message: process.env.NODE_ENV === "production" ? "stream failed" : error instanceof Error ? error.message : "stream failed" }); res.end(); }
  }
});

export default router;
