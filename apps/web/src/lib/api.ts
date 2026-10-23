import type { ChatMessage, Conversation } from "@/types/chat";
import { API, clearSession, getSession, refreshSession } from "@/lib/auth";
import { PREFERENCES_KEY, loadPreferences } from "@/lib/preferences";
export async function request(path: string, init: RequestInit = {}, retry = true) { const headers = new Headers(init.headers); if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json"); if (["POST","PUT","PATCH","DELETE"].includes((init.method || "GET").toUpperCase())) headers.set("X-CSRF-Protection", "1"); const session = getSession(); if (session?.accessToken) headers.set("Authorization", `Bearer ${session.accessToken}`); let res = await fetch(`${API}${path}`, { ...init, credentials: "include", headers }); if (res.status === 401 && retry) { const refreshed = await refreshSession(); if (refreshed) { const retryHeaders = new Headers(init.headers); if (!(init.body instanceof FormData)) retryHeaders.set("Content-Type", "application/json"); if (["POST","PUT","PATCH","DELETE"].includes((init.method || "GET").toUpperCase())) retryHeaders.set("X-CSRF-Protection", "1"); if (refreshed.accessToken) retryHeaders.set("Authorization", `Bearer ${refreshed.accessToken}`); res = await fetch(`${API}${path}`, { ...init, credentials: "include", headers: retryHeaders }); } else clearSession(); } return res; }
type ChatStreamResult = { reply?: string; title?: string; imagePrompt?: string; [key: string]: unknown };
async function readChatStream(response: Response, onToken?: (token: string) => void): Promise<ChatStreamResult> {
  if (!response.body) throw new Error("Jarvis returned an empty stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  const state: { completed: ChatStreamResult | null; streamError: string } = { completed: null, streamError: "" };
  const consume = (block: string) => {
    let event = "";
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trim());
    }
    if (!data.length) return;
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(data.join("\n")) as Record<string, unknown>; }
    catch { throw new Error("Jarvis returned an invalid stream event."); }
    if (event === "token" && typeof payload.token === "string") onToken?.(payload.token);
    else if (event === "done") state.completed = payload as ChatStreamResult;
    else if (event === "error") state.streamError = typeof payload.message === "string" ? payload.message : "The AI stream failed.";
  };
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      pending += decoder.decode(chunk.value, { stream: true });
      let separator = pending.match(/\r?\n\r?\n/);
      while (separator && separator.index !== undefined) {
        const frameEnd = separator.index;
        consume(pending.slice(0, frameEnd).replace(/\r/g, ""));
        pending = pending.slice(frameEnd + separator[0].length);
        separator = pending.match(/\r?\n\r?\n/);
      }
    }
    pending += decoder.decode();
    if (pending.trim()) consume(pending.replace(/\r/g, ""));
  } catch (error) { await reader.cancel().catch(() => undefined); throw error; }
  if (state.streamError) throw new Error(state.streamError);
  if (!state.completed) throw new Error("Jarvis stream ended before the response was complete.");
  return state.completed;
}
/** Generation (never the birth year) and whether Jarvis may learn the user's texting style. */
function styleOptions() { const preferences = loadPreferences(); return { ...(preferences.generation ? { generation: preferences.generation } : {}), learnStyle: preferences.learnStyle }; }
export async function sendMessage(messages: ChatMessage[], personality = "", modelId?: string, memoryEnabled?: boolean, conversationId?: string, onToken?: (token: string) => void, signal?: AbortSignal, assistantMessageId?: string) { const latestUserMessageId = [...messages].reverse().find((message) => message.role === "user")?.id; const cleanMessages = messages.map((m) => ({ role: m.role, content: m.content, ...(m.id === latestUserMessageId ? { id: m.id } : {}), ...(m.ephemeral ? { ephemeral: true } : {}), ...(m.id === latestUserMessageId && m.images?.length ? { attachments: m.images.filter((image) => typeof image.url === "string" && image.url.startsWith("data:image/")).slice(0, 3).map((image) => ({ type: "image", mimeType: image.url.slice(5, image.url.indexOf(";") > -1 ? image.url.indexOf(";") : image.url.indexOf(",")), data: image.url })) } : {}) })); let effectiveMemory = memoryEnabled; let projectContext = ""; if (typeof window !== "undefined") { try { const settings = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || localStorage.getItem("bobai.settings.v1") || "{}"); if (typeof effectiveMemory !== "boolean") effectiveMemory = settings.memory !== false; if (settings.projectContext && typeof settings.projectContext === "object") { const name = typeof settings.projectContext.name === "string" ? settings.projectContext.name : ""; const instructions = typeof settings.projectContext.instructions === "string" ? settings.projectContext.instructions : ""; if (instructions.trim()) projectContext = `\nActive project: ${name || "untitled"}\nProject instructions:\n${instructions.slice(0, 12_000)}`; } } catch { if (typeof effectiveMemory !== "boolean") effectiveMemory = true; } } if (typeof effectiveMemory !== "boolean") effectiveMemory = true; const res = await request("/stream", { method: "POST", body: JSON.stringify({ messages: cleanMessages, personality: `${personality}${projectContext}`, memoryEnabled: effectiveMemory, ...styleOptions(), ...(conversationId ? { conversationId } : {}), ...(modelId ? { modelId } : {}), ...(assistantMessageId ? { assistantMessageId } : {}) }), signal }); if (!res.ok) { const raw = await res.text(); let providerMessage = ""; try { const parsed = JSON.parse(raw) as { error?: unknown }; if (typeof parsed.error === "string") providerMessage = parsed.error; } catch { /* keep provider internals out of the chat UI */ } if (res.status === 401) throw new Error("Your session has expired. Please verify your email again."); if (res.status === 429) throw new Error("Jarvis is receiving too many requests right now. Wait a moment and try again."); if (res.status >= 500) throw new Error("The AI service is temporarily unavailable. Please try again in a moment."); throw new Error(providerMessage || "Jarvis could not process that request. Please try again."); } return await readChatStream(res, onToken); }
async function loadSavedImage(image: Record<string, unknown>) {
  const serverImageId = typeof image.serverImageId === "string" ? image.serverImageId : "";
  if (!serverImageId) {
    if (typeof image.url === "string" && !image.url.startsWith("data:image/")) {
      return { id: typeof image.id === "string" ? image.id : crypto.randomUUID(), url: image.url, prompt: typeof image.prompt === "string" ? image.prompt : "" };
    }
    return null;
  }
  try {
    const res = await request(`/images/${encodeURIComponent(serverImageId)}`);
    if (!res.ok) return null;
    const data = await res.json() as { image?: { url?: unknown; prompt?: unknown } };
    if (typeof data.image?.url !== "string" || !data.image.url.startsWith("data:image/")) return null;
    return { id: serverImageId, serverImageId, url: data.image.url, prompt: typeof image.prompt === "string" ? image.prompt : typeof data.image.prompt === "string" ? data.image.prompt : "" };
  } catch {
    return null;
  }
}
export async function listConversations(includeArchived = false): Promise<Conversation[]> {
  const res = await request(`/conversations${includeArchived ? "?archived=true" : ""}`);
  if (!res.ok) throw new Error((await res.text()) || "Failed to load conversations");
  // The API pages conversations as { items, nextCursor }; older builds answered { conversations }.
  const data = await res.json() as { items?: Array<Record<string, unknown>>; conversations?: Array<Record<string, unknown>> };
  return Promise.all((data.items || data.conversations || []).map(async (conversation) => ({
    id: String(conversation.id),
    title: typeof conversation.title === "string" ? conversation.title : "new chat",
    createdAt: new Date(String(conversation.createdAt || Date.now())).getTime(),
    pinned: conversation.isPinned === true,
    messages: await Promise.all((Array.isArray(conversation.messages) ? conversation.messages : []).map(async (message) => {
      const item = message as Record<string, unknown>;
      const attachments = item.attachments as Record<string, unknown> | null;
      const rawImages = attachments && Array.isArray(attachments.images) ? attachments.images : [];
      const images = (await Promise.all(rawImages.filter((image): image is Record<string, unknown> => Boolean(image) && typeof image === "object" && !Array.isArray(image)).map(loadSavedImage))).filter((image) => image !== null);
      return {
        id: String(item.id),
        role: item.role === "assistant" ? "assistant" as const : "user" as const,
        content: typeof item.content === "string" ? item.content : "",
        ...(images.length ? { images } : {}),
        ...(attachments && typeof attachments === "object" && Array.isArray(attachments.files) ? { files: attachments.files as ChatMessage["files"] } : {}),
        ...(attachments?.pinned === true ? { pinned: true } : {}),
        ...(item.role === "assistant" && typeof item.model === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}$/.test(item.model) && !["bob", "coding-agent"].includes(item.model) ? { model: item.model } : {}),
      };
    })),
  })));
}
export async function saveConversation(conversation: Conversation) { const res = await request("/conversations", { method: "POST", body: JSON.stringify({ id: conversation.id, title: conversation.title, messages: conversation.messages.map((message) => ({ id: message.id, role: message.role, content: message.content, ...(message.model ? { model: message.model } : {}), status: "completed", attachments: { ...(message.images?.length ? { images: message.images.filter((image) => Boolean(image.serverImageId) || !image.url.startsWith("data:image/")).map((image) => image.serverImageId ? { serverImageId: image.serverImageId, prompt: image.prompt } : image) } : {}), ...(message.files?.length ? { files: message.files } : {}), ...(message.pinned ? { pinned: true } : {}) } })) }) }); if (!res.ok) throw new Error((await res.text()) || "Failed to save conversation"); }
export async function updateConversation(conversationId: string, changes: { title?: string; isPinned?: boolean; isArchived?: boolean }) { const res = await request(`/conversations/${encodeURIComponent(conversationId)}`, { method: "PATCH", body: JSON.stringify(changes) }); if (!res.ok) throw new Error((await res.text()) || "Failed to update conversation"); return res.json(); }
export async function deleteConversation(conversationId: string) { const res = await request(`/conversations/${encodeURIComponent(conversationId)}`, { method: "DELETE" }); if (!res.ok && res.status !== 404) throw new Error((await res.text()) || "Failed to delete conversation"); }
export async function listMemories() { const res = await request("/memory"); const data = await res.json(); if (!res.ok) throw new Error(data.error || "Failed to load memory"); return data.memories as Array<Record<string, unknown>>; }
export async function updateMemory(id: string, input: Record<string, unknown>) { const res = await request(`/memory/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || "Failed to update memory"); return data.memory; }
export async function deleteMemory(id: string) { const res = await request(`/memory/${encodeURIComponent(id)}`, { method: "DELETE" }); if (!res.ok) throw new Error((await res.text()) || "Failed to delete memory"); }
export async function clearMemories() { const res = await request("/memory", { method: "DELETE" }); const data = await res.json(); if (!res.ok) throw new Error(data.error || "Failed to clear memory"); return data as { success: boolean; persistent: boolean }; }
export async function exportAccountData(): Promise<Blob> { const res = await request("/account/export"); if (!res.ok) { let message = "Account export failed."; try { const data = await res.json() as { error?: unknown }; if (typeof data.error === "string") message = data.error; } catch {} throw new Error(message); } return res.blob(); }
export async function getModelStatus(): Promise<{ ready?: boolean; provider?: string; model?: string; modelId?: string; error?: string }> { const res = await request("/model/status"); const data = await res.json(); if (!res.ok) throw new Error(data.error || "Could not load provider status"); return data; }
export async function requestAccountDeletionCode() { const res = await request("/account/delete/request", { method: "POST", body: JSON.stringify({}) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || "Could not send account deletion code"); return data as { message?: string }; }
export async function confirmAccountDeletion(code: string) { const res = await request("/account/delete/confirm", { method: "POST", body: JSON.stringify({ code }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || "Could not schedule account deletion"); return data as { status: string; permanentDeletionAfterDays: number }; }
export async function generateImage(prompt: string, inputImages: string[] = [], signal?: AbortSignal) { const res = await request("/images/generate", { method: "POST", body: JSON.stringify({ prompt, count: 1, inputImages }), signal }); const data = await res.json(); if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Image generation failed"); return data as { images: Array<{ id: string; url: string; prompt: string; metadata?: unknown }> }; }
export async function uploadFile(file: File, onProgress?: (progress: number) => void, signal?: AbortSignal) { const form = new FormData(); form.append("file", file); const session = getSession(); return new Promise<{ id?: string; name: string; type: string; text: string }>((resolve, reject) => { const xhr = new XMLHttpRequest(); const abort = () => { xhr.abort(); const error = new Error("Upload cancelled."); error.name = "AbortError"; reject(error); }; if (signal?.aborted) return abort(); signal?.addEventListener("abort", abort, { once: true }); const cleanup = () => signal?.removeEventListener("abort", abort); xhr.open("POST", `${API}/files/upload`); xhr.withCredentials = true; xhr.setRequestHeader("X-CSRF-Protection", "1"); if (session?.accessToken) xhr.setRequestHeader("Authorization", `Bearer ${session.accessToken}`); xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); }; xhr.onload = () => { cleanup(); if (xhr.status >= 200 && xhr.status < 300) { try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error("Invalid upload response")); } } else { let message = "Upload failed"; try { const parsed = JSON.parse(xhr.responseText) as { error?: unknown }; if (typeof parsed.error === "string") message = parsed.error; } catch { /* keep the generic message */ } reject(new Error(message)); } }; xhr.onerror = () => { cleanup(); reject(new Error("Upload failed")); }; xhr.onabort = () => { cleanup(); const error = new Error("Upload cancelled."); error.name = "AbortError"; reject(error); }; xhr.send(form); }); }
export type DeepResearchResult = { query: string; sources: Array<{ title: string; url: string; snippet?: string; publishedAt?: string; score?: number; credibility?: "high" | "medium" | "low" }>; evidence: Array<{ url: string; title: string; excerpt: string }>; synthesis: string; mode?: string };
export type StudyPack = { title: string; summary: string; keyPoints: string[]; flashcards: Array<{ question: string; answer: string }>; quiz: Array<{ question: string; options: string[]; answer: string; explanation: string }>; weakAreas: string[] };

export async function approveAndRunTool(tool: string, workspaceId: string, args: Record<string, unknown>) {
  const approve = await request(`/tools/${encodeURIComponent(tool)}/approve`, { method: "POST", body: JSON.stringify({ workspaceId }) });
  const grant = await approve.json().catch(() => ({})) as { token?: string; error?: string };
  if (!approve.ok || typeof grant.token !== "string") throw new Error(grant.error || "The approval could not be recorded.");
  const run = await request(`/tools/${encodeURIComponent(tool)}/execute`, { method: "POST", body: JSON.stringify({ workspaceId, approvalToken: grant.token, arguments: args }) });
  const data = await run.json().catch(() => ({})) as { result?: string; error?: string };
  if (!run.ok) throw new Error(data.error || `The tool failed with HTTP ${run.status}.`);
  return typeof data.result === "string" ? data.result : "";
}

/** Removes one stored message so deleted or regenerated replies do not come back after a reload. */
export async function deleteRemoteMessage(conversationId: string, messageId: string) {
  const res = await request(`/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error("The message could not be deleted on the server.");
}
export async function deleteSetting(key: string) { const res = await request(`/settings/${encodeURIComponent(key)}`, { method: "DELETE" }); if (!res.ok) throw new Error("Could not reset that setting"); }
