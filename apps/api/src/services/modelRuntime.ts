import os from "node:os";
import { bobNativeModel } from "./nativeModel.js";

export type RuntimeCapability = "chat" | "coding" | "vision" | "embedding" | "reranking" | "asr" | "tts" | "image";
export type RuntimeState = "cold" | "loading" | "ready" | "busy" | "error";
export type RuntimeModel = { id: string; capability: RuntimeCapability; memoryMb: number; priority: number; runnable: boolean; description: string };
export type RuntimeSnapshot = RuntimeModel & { state: RuntimeState; activeRequests: number; loadedAt?: string; lastUsedAt?: string; error?: string };
export type TaskPlan = { capabilities: RuntimeCapability[]; primary: RuntimeCapability; modelId?: string; reason: string; requiresSpecialist: boolean };
type Adapter = { start: () => Promise<void>; stop?: () => Promise<void>; ready?: () => Promise<boolean> };
type Entry = { model: RuntimeModel; state: RuntimeState; activeRequests: number; loadedAt?: string; lastUsedAt?: string; error?: string; adapter?: Adapter };

const MODEL_BUDGET_MB = 3072;
const IDLE_UNLOAD_MS = 300000;
export const RUNTIME_MODELS: RuntimeModel[] = [
  { id: "bob", capability: "chat", memoryMb: 512, priority: 100, runnable: true, description: "BobAI central text model" },
  { id: "coder", capability: "coding", memoryMb: 512, priority: 90, runnable: true, description: "BobAI coding profile" },
  { id: "bob-embed-0.1", capability: "embedding", memoryMb: 384, priority: 60, runnable: false, description: "Embedding specialist" },
  { id: "bob-reranker-0.1", capability: "reranking", memoryMb: 256, priority: 55, runnable: false, description: "Retrieval reranker specialist" },
  { id: "bob-vision-0.1", capability: "vision", memoryMb: 768, priority: 70, runnable: false, description: "Vision specialist" },
  { id: "bob-asr-0.1", capability: "asr", memoryMb: 768, priority: 70, runnable: false, description: "Speech recognition specialist" },
  { id: "bob-tts-0.1", capability: "tts", memoryMb: 768, priority: 65, runnable: false, description: "Speech synthesis specialist" },
  { id: "bob-image-0.1", capability: "image", memoryMb: 1024, priority: 50, runnable: false, description: "Image generation specialist" },
];

function messageText(messages: unknown) {
  if (!Array.isArray(messages)) return "";
  return messages.map((item) => item && typeof item === "object" && typeof (item as { content?: unknown }).content === "string" ? (item as { content: string }).content : "").join(" ").toLowerCase().slice(-12000);
}

export function inferTaskPlan(input: { messages?: unknown; hasImage?: boolean; hasAudio?: boolean; wantsImage?: boolean; wantsSpeech?: boolean }): TaskPlan {
  const text = messageText(input.messages); const capabilities: RuntimeCapability[] = [];
  const add = (value: RuntimeCapability) => { if (!capabilities.includes(value)) capabilities.push(value); };
  if (input.hasImage || /\b(image|photo|picture|screenshot|vision|see|look at)\b/.test(text)) add("vision");
  if (input.hasAudio || /\b(audio|voice|speech|listen|transcribe|transcription|hear)\b/.test(text)) add("asr");
  if (input.wantsSpeech || /\b(speak|read aloud|voice response|pronounce)\b/.test(text)) add("tts");
  if (input.wantsImage || /\b(generate|create|draw|make)\b.{0,40}\b(image|picture|art|illustration)\b/.test(text)) add("image");
  if (/\b(remember|memory|similar|semantic|embed|embedding)\b/.test(text)) add("embedding");
  if (/\b(search|retrieve|rank|relevant|best match)\b/.test(text)) add("reranking");
  if (/\b(code|coding|program|debug|typescript|javascript|python|sql)\b/.test(text)) add("coding");
  if (!capabilities.length) add("chat");
  const primary = capabilities[0]; const runnable = RUNTIME_MODELS.find((model) => model.capability === primary && model.runnable); const specialist = RUNTIME_MODELS.find((model) => model.capability === primary);
  return { capabilities, primary, modelId: runnable?.id || specialist?.id, reason: runnable ? `selected ${runnable.id}` : `${primary} specialist runtime required`, requiresSpecialist: !runnable };
}

export class ModelRuntimeManager {
  private readonly entries = new Map<string, Entry>(RUNTIME_MODELS.map((model) => [model.id, { model, state: "cold", activeRequests: 0 }]));
  private loadedMemory() { return [...this.entries.values()].filter((entry) => entry.state === "ready" || entry.state === "busy").reduce((sum, entry) => sum + entry.model.memoryMb, 0); }
  constructor() {
    const adapter: Adapter = { start: () => bobNativeModel.load(), stop: () => bobNativeModel.unload(), ready: async () => bobNativeModel.isAvailable() };
    this.registerAdapter("bob", adapter); this.registerAdapter("coder", adapter);
    const timer = setInterval(() => { void this.evictIdle(); }, 60000); timer.unref();
  }
  registerAdapter(id: string, adapter: Adapter) { const entry = this.entries.get(id); if (!entry) throw new Error(`unknown runtime model: ${id}`); entry.adapter = adapter; }
  private async evictFor(required: Entry, protectedId: string) {
    while (this.loadedMemory() + required.model.memoryMb > MODEL_BUDGET_MB) {
      const victims = [...this.entries.values()].filter((entry) => entry.model.id !== protectedId && entry.activeRequests === 0 && entry.state === "ready").sort((a, b) => a.model.priority - b.model.priority || Date.parse(a.lastUsedAt || "1970-01-01") - Date.parse(b.lastUsedAt || "1970-01-01"));
      const victim = victims[0]; if (!victim) throw new Error("model memory budget is exhausted"); await this.unload(victim.model.id);
    }
  }
  async load(id: string) {
    const entry = this.entries.get(id); if (!entry) throw new Error(`unknown runtime model: ${id}`); if (!entry.model.runnable) throw new Error(`runtime adapter is not installed for ${id}`); if (entry.state === "ready" || entry.state === "busy") return;
    if (entry.adapter?.ready && !(await entry.adapter.ready())) throw new Error(`model artifact is unavailable for ${id}`);
    await this.evictFor(entry, id); entry.state = "loading"; entry.error = undefined;
    try { if (!entry.adapter) throw new Error(`no runtime adapter for ${id}`); await entry.adapter.start(); entry.state = "ready"; entry.loadedAt = new Date().toISOString(); entry.lastUsedAt = entry.loadedAt; } catch (error) { entry.state = "error"; entry.error = error instanceof Error ? error.message : "model load failed"; throw error; }
  }
  async acquire(id: string) { await this.load(id); const entry = this.entries.get(id)!; entry.activeRequests += 1; entry.state = "busy"; entry.lastUsedAt = new Date().toISOString(); let released = false; return () => { if (released) return; released = true; entry.activeRequests = Math.max(0, entry.activeRequests - 1); entry.state = entry.activeRequests ? "busy" : "ready"; entry.lastUsedAt = new Date().toISOString(); }; }
  async unload(id: string) { const entry = this.entries.get(id); if (!entry || entry.activeRequests) return false; if (entry.adapter?.stop) await entry.adapter.stop(); entry.state = "cold"; entry.loadedAt = undefined; return true; }
  async evictIdle() { const cutoff = Date.now() - IDLE_UNLOAD_MS; for (const entry of this.entries.values()) if (!entry.activeRequests && entry.state === "ready" && entry.lastUsedAt && Date.parse(entry.lastUsedAt) < cutoff) await this.unload(entry.model.id).catch(() => undefined); }
  snapshot(): RuntimeSnapshot[] { return [...this.entries.values()].map(({ model, state, activeRequests, loadedAt, lastUsedAt, error }) => ({ ...model, state, activeRequests, loadedAt, lastUsedAt, error })); }
  resources() { return { totalMemoryMb: Math.round(os.totalmem() / 1048576), freeMemoryMb: Math.round(os.freemem() / 1048576), cpuCount: os.cpus().length, modelBudgetMb: MODEL_BUDGET_MB, loadedModelMemoryMb: this.loadedMemory() }; }
  async plan(input: Parameters<typeof inferTaskPlan>[0]) { const plan = inferTaskPlan(input); const model = RUNTIME_MODELS.find((candidate) => candidate.capability === plan.primary && candidate.runnable); const specialist = RUNTIME_MODELS.find((candidate) => candidate.capability === plan.primary); if (!model) return { ...plan, available: false, runtime: specialist ? this.snapshot().find((candidate) => candidate.id === specialist.id) : undefined }; await this.load(model.id); return { ...plan, modelId: model.id, available: true, runtime: this.snapshot().find((candidate) => candidate.id === model.id) }; }
}
export const modelRuntime = new ModelRuntimeManager();
