import type { ChatMessage, Conversation } from "@/types/chat";
import { clearSession, getSession, refreshSession } from "@/lib/auth";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function request(path: string, init: RequestInit = {}, retry = true) {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const session = getSession();
  if (session?.accessToken) headers.set("Authorization", `Bearer ${session.accessToken}`);
  let res = await fetch(`${API}${path}`, { ...init, credentials: "include", headers });
  if (res.status === 401 && retry) {
    const refreshed = await refreshSession();
    if (refreshed?.accessToken) {
      const retryHeaders = new Headers(init.headers);
      if (!(init.body instanceof FormData)) retryHeaders.set("Content-Type", "application/json");
      retryHeaders.set("Authorization", `Bearer ${refreshed.accessToken}`);
      res = await fetch(`${API}${path}`, { ...init, credentials: "include", headers: retryHeaders });
    } else clearSession();
  }
  return res;
}

export async function sendMessage(messages: ChatMessage[], personality = "", modelId?: string, memoryEnabled?: boolean) {
  const cleanMessages = messages.map((m) => ({ role: m.role, content: m.content }));
  let effectiveMemory = memoryEnabled;
  let projectContext = "";
  if (typeof window !== "undefined") {
    try {
      const settings = JSON.parse(localStorage.getItem("bobai.settings.v1") || "{}");
      if (typeof effectiveMemory !== "boolean") effectiveMemory = settings.memory !== false;
      if (settings.projectContext && typeof settings.projectContext === "object") {
        const name = typeof settings.projectContext.name === "string" ? settings.projectContext.name : "";
        const instructions = typeof settings.projectContext.instructions === "string" ? settings.projectContext.instructions : "";
        if (instructions.trim()) projectContext = `\nActive project: ${name || "untitled"}\nProject instructions:\n${instructions.slice(0, 12_000)}`;
      }
    } catch {
      if (typeof effectiveMemory !== "boolean") effectiveMemory = true;
    }
  }
  if (typeof effectiveMemory !== "boolean") effectiveMemory = true;
  const res = await request("/chat", { method: "POST", body: JSON.stringify({ messages: cleanMessages, personality: `${personality}${projectContext}`, memoryEnabled: effectiveMemory, ...(modelId ? { modelId } : {}) }) });
  if (!res.ok) throw new Error((await res.text()) || "Failed to send message");
  return res.json();
}
export async function listConversations(): Promise<Conversation[]> { const res = await request("/conversations"); if (!res.ok) throw new Error((await res.text()) || "Failed to load conversations"); const data = await res.json() as { conversations?: Array<Record<string, unknown>> }; return (data.conversations || []).map((conversation) => ({ id: String(conversation.id), title: typeof conversation.title === "string" ? conversation.title : "new chat", createdAt: new Date(String(conversation.createdAt || Date.now())).getTime(), pinned: false, messages: Array.isArray(conversation.messages) ? conversation.messages.map((message) => { const item = message as Record<string, unknown>; const attachments = item.attachments as Record<string, unknown> | null; return { id: String(item.id), role: item.role === "assistant" ? "assistant" as const : "user" as const, content: typeof item.content === "string" ? item.content : "", ...(attachments && typeof attachments === "object" ? attachments : {}) }; }) : [] })); }
export async function saveConversation(conversation: Conversation) { const res = await request("/conversations", { method: "POST", body: JSON.stringify({ id: conversation.id, title: conversation.title, messages: conversation.messages.map((message) => ({ id: message.id, role: message.role, content: message.content, status: "completed", attachments: { ...(message.images?.length ? { images: message.images } : {}), ...(message.files?.length ? { files: message.files } : {}), ...(message.pinned ? { pinned: true } : {}) } })) }) }); if (!res.ok) throw new Error((await res.text()) || "Failed to save conversation"); }
export async function deleteConversation(conversationId: string) { const res = await request(`/conversations/${encodeURIComponent(conversationId)}`, { method: "DELETE" }); if (!res.ok && res.status !== 404) throw new Error((await res.text()) || "Failed to delete conversation"); }
export async function generateImage(prompt: string) { const res = await request("/images/generate", { method: "POST", body: JSON.stringify({ prompt, count: 4, width: 1024, height: 1024 }) }); if (!res.ok) throw new Error((await res.text()) || "Failed to generate image"); return res.json(); }
export async function uploadFile(file: File, onProgress?: (progress: number) => void) { const form = new FormData(); form.append("file", file); const session = getSession(); return new Promise<{ id?: string; name: string; type: string; text: string }>((resolve, reject) => { const xhr = new XMLHttpRequest(); xhr.open("POST", `${API}/files/upload`); xhr.withCredentials = true; if (session?.accessToken) xhr.setRequestHeader("Authorization", `Bearer ${session.accessToken}`); xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); }; xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) { try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error("Invalid upload response")); } } else reject(new Error(xhr.responseText || "Upload failed")); }; xhr.onerror = () => reject(new Error("Upload failed")); xhr.send(form); }); }

export async function runCodingAgent(task: string): Promise<{ output: string; warnings: string }> {
  const res = await request("/agents/user/run", { method: "POST", body: JSON.stringify({ task, kind: "coding" }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Coding agent failed");
  const jobId = typeof data.id === "string" ? data.id : "";
  if (!jobId) throw new Error("Coding agent returned no job id");
  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    const statusRes = await request(`/agents/user/queue/${encodeURIComponent(jobId)}`);
    const status = await statusRes.json();
    if (!statusRes.ok) throw new Error(status.error || "Coding agent status unavailable");
    if (status.status === "completed") {
      const taskResult = status.result as { result?: { output?: string; warnings?: string } } | null;
      const result = taskResult?.result;
      return { output: typeof result?.output === "string" ? result.output : JSON.stringify(result ?? ""), warnings: typeof result?.warnings === "string" ? result.warnings : "" };
    }
    if (status.status === "failed") throw new Error(status.error || "Coding agent failed");
  }
  throw new Error("Coding agent timed out");
}

export type DeepResearchResult = { query: string; sources: Array<{ id: number; title: string; url: string }>; evidence: Array<{ url: string; title: string; excerpt: string }>; synthesis: string; mode?: string };
export async function deepResearch(query: string): Promise<DeepResearchResult> { const res = await request("/deep-research", { method: "POST", body: JSON.stringify({ query }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || "Deep Research failed"); return data as DeepResearchResult; }
export type StudyPack = { title: string; summary: string; keyPoints: string[]; flashcards: Array<{ question: string; answer: string }>; quiz: Array<{ question: string; options: string[]; answer: string; explanation: string }>; weakAreas: string[] };
export async function studyPack(source: string, difficulty = "medium"): Promise<StudyPack> { const res = await request("/study/pack", { method: "POST", body: JSON.stringify({ source, difficulty }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || "Study mode failed"); return data as StudyPack; }
export async function listProjects(): Promise<Array<{ id: string; name: string; description?: string | null; settings?: unknown }>> { const res = await request("/projects"); const data = await res.json(); if (!res.ok) throw new Error(data.error || "Failed to load projects"); return Array.isArray(data.projects) ? data.projects : []; }
export async function createProject(input: { name: string; description?: string; instructions?: string }) { const res = await request("/projects", { method: "POST", body: JSON.stringify(input) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || "Failed to create project"); return data.project as { id: string; name: string; description?: string | null; settings?: unknown }; }
export async function updateProject(id: string, input: { name: string; description?: string; instructions?: string }) { const res = await request(`/projects/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || "Failed to update project"); return data.project as { id: string; name: string; description?: string | null; settings?: unknown }; }
export async function createArtifact(prompt: string, personality = "") { const result = await sendMessage([{ id: crypto.randomUUID(), role: "user", content: `Create an editable artifact for this request. Return a clean, self-contained result that can be edited directly by the user. If code is appropriate, include the complete code. Request: ${prompt}` }], `${personality}\nPrioritize practical, structured output suitable for an editable artifact.`); return String(result.reply || ""); }