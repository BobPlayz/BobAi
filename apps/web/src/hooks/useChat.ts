"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { setAssistantActivity } from "@/lib/assistantState";
import { loadPreferences } from "@/lib/preferences";
import { topicOf, visualKind } from "@/lib/visuals";
import { approveAndRunTool, autoTitleConversation, cancelGeneration, fetchSavedReply, searchPictures, shareConversation, unshareConversation, deleteRemoteMessage, deleteConversation as deleteRemoteConversation, generateImage, listConversations, saveConversation, sendMessage, updateConversation as updateRemoteConversation, uploadFile } from "@/lib/api";
import type { Conversation, ChatMessage, ChatImage, ChatFile, LiveDataInfo, ToolApproval } from "@/types/chat";
const STORAGE_KEY = "bobai.conversation-ui.v3";
const LEGACY_STORAGE_KEY = "bobai.conversations.v2";
type GeneratedImage = { id?: string; url: string; prompt?: string };
type ChatSettings = { personality: string; memory?: boolean };
function readImageDataUrl(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("The image could not be read.")); reader.onerror = () => reject(new Error("The image could not be read.")); reader.readAsDataURL(file); }); }
function createConversation(): Conversation { return { id: crypto.randomUUID(), title: "new chat", createdAt: Date.now(), pinned: false, messages: [] }; }
function loadSettings(): ChatSettings { const { personality, memory } = loadPreferences(); return { personality, memory }; }
function loadLocalConversationUi(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    // Remove the previous cache format because it could contain full conversation content.
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(data)) return [];
    return data.flatMap((item: unknown) => {
      const value = item as Record<string, unknown> | null;
      if (!value || typeof value.id !== "string") return [];
      return [{ id: value.id, title: typeof value.title === "string" ? value.title.slice(0, 200) : "new chat", createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now(), pinned: value.pinned === true, messages: [] }];
    });
  } catch { return []; }
}
/** Only plain http://localhost links to a /sites/<name>/ page are shown as a button. */
function localSiteFrom(value: unknown): Pick<ChatMessage, "localSite"> {
  const site = value as { url?: unknown; name?: unknown } | undefined;
  if (!site || typeof site.url !== "string" || typeof site.name !== "string" || !/^http:\/\/localhost:\d{2,5}\/sites\/[a-z0-9-]+\/$/.test(site.url)) return {};
  // Opened from another device (a phone using a board's address)? "localhost" would mean that device, so use the
  // address Jarvis was opened from instead.
  const url = new URL(site.url);
  if (typeof window !== "undefined" && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) url.hostname = window.location.hostname;
  return { localSite: { url: url.toString(), name: site.name } };
}
function liveAndApproval(result: Record<string, unknown>): Pick<ChatMessage, "liveData" | "approval" | "model" | "compacted" | "localSite" | "incomplete"> {
  const live = result.liveData as LiveDataInfo | undefined;
  const approval = result.approval as Omit<ToolApproval, "state"> | undefined;
  // The Ollama model that actually answered, shown under the reply.
  const model = typeof result.model === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}$/.test(result.model) && !["bob", "coding-agent"].includes(result.model) ? result.model : undefined;
  return {
    ...(model ? { model } : {}),
    ...(typeof result.compacted === "number" && result.compacted > 0 ? { compacted: result.compacted } : {}),
    ...(result.incomplete === true ? { incomplete: true } : {}),
    ...localSiteFrom(result.localSite),
    ...(live && typeof live.provider === "string" ? { liveData: { ...live, sources: Array.isArray(live.sources) ? live.sources.filter((source) => typeof source?.url === "string" && /^https?:\/\//.test(source.url)) : [] } } : {}),
    ...(approval && typeof approval.tool === "string" && typeof approval.workspaceId === "string" ? { approval: { ...approval, arguments: approval.arguments && typeof approval.arguments === "object" ? approval.arguments : {}, state: "pending" as const } } : {}),
  };
}
/** Vercel refuses request bodies over 4.5 MB, so uploads are capped just under it. */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Scales a photo down to at most 1600 px and re-encodes it as JPEG (about 0.3-0.9 MB) when it is bigger than 900 KB. */
async function shrinkImage(file: File): Promise<File> {
  if (file.size <= 900_000 || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    for (const quality of [0.85, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= 950_000) return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg", lastModified: file.lastModified });
    }
  } catch { /* fall back to the original file */ }
  return file;
}

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]); const [activeId, setActiveId] = useState(""); const [input, setInput] = useState(""); const [search, setSearch] = useState(""); const [loadingConversationIds, setLoadingConversationIds] = useState<Set<string>>(() => new Set()); const loadingConversationId = loadingConversationIds.has(activeId) ? activeId : null; const [settings, setSettings] = useState<ChatSettings>(loadSettings); const [uploadingFiles, setUploadingFiles] = useState<string[]>([]); const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({}); const [serverReady, setServerReady] = useState(false); const streaming = Boolean(activeStreams.current.get(activeId)); const [generatingImageIds, setGeneratingImageIds] = useState<Set<string>>(() => new Set()); const generatingImage = generatingImageIds.has(activeId); const activeStreams = useRef(new Map<string, { controller: AbortController; assistantId: string }>()); /** The reply produced in this page session that voice replies may speak; old replies are never auto-played. */ const [lastReplyId, setLastReplyId] = useState<string | null>(null); const uploadControllers = useRef(new Map<string, AbortController>());
  useEffect(() => () => { for (const stream of activeStreams.current.values()) stream.controller.abort(); activeStreams.current.clear(); for (const controller of uploadControllers.current.values()) controller.abort(); uploadControllers.current.clear(); }, []);
  useEffect(() => {
    let cancelled = false;
    // The chat page always opens on a fresh, empty chat; saved chats stay in the sidebar.
    const localConversations = loadLocalConversationUi();
    const fresh = createConversation();
    setConversations([fresh, ...localConversations]);
    setActiveId(fresh.id);
    void listConversations().then((remote) => {
      if (cancelled) return;
      if (remote.length) {
        const localById = new Map(localConversations.map((conversation) => [conversation.id, conversation]));
        const merged = remote.map((conversation) => ({ ...conversation, pinned: localById.get(conversation.id)?.pinned ?? false }));
        setConversations((current) => [...current.filter((conversation) => conversation.messages.length === 0 && !merged.some((saved) => saved.id === conversation.id)), ...merged]);
        // A reply still being written when the page was reloaded or closed: keep following it until it's saved.
        for (const conversation of merged) for (const message of conversation.messages) {
          if (message.streaming) void recoverReply(conversation.id, message.id).then((reply) => { if (!reply) updateConversation(conversation.id, (c) => ({ ...c, messages: c.messages.map((m) => m.id === message.id ? { ...m, streaming: false, incomplete: true } : m) })); });
        }
      }
      setServerReady(true);
    }).catch(() => {
      if (!cancelled) setServerReady(true);
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!conversations.length) return;
    // Persist only non-sensitive UI metadata. Conversation/message content stays server-backed.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.map(({ id, title, createdAt, pinned }) => ({ id, title, createdAt, pinned }))));
  }, [conversations]);
  // Sync only the open conversation. Re-posting every conversation on every keystroke-level change was wasteful.
  useEffect(() => { if (!serverReady) return; const current = conversations.find((conversation) => conversation.id === activeId); if (!current || !current.messages.length) return; const timer = window.setTimeout(() => { void saveConversation(current).catch(() => undefined); }, 800); return () => window.clearTimeout(timer); }, [conversations, activeId, serverReady]);
  const activeConversation = conversations.find((c) => c.id === activeId); const visibleConversations = useMemo(() => conversations.filter((c) => c.messages.length > 0 && c.title.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : b.createdAt - a.createdAt), [conversations, search]);
  function updateConversation(id: string, updater: (c: Conversation) => Conversation) { setConversations((prev) => prev.map((c) => c.id === id ? updater(c) : c)); }
  function setConversationLoading(id: string, loading: boolean) { setLoadingConversationIds((current) => { const next = new Set(current); if (loading) next.add(id); else next.delete(id); return next; }); }
  function setConversationImageGenerating(id: string, generating: boolean) { setGeneratingImageIds((current) => { const next = new Set(current); if (generating) next.add(id); else next.delete(id); return next; }); }
  function imageMessage(images: GeneratedImage[]): ChatMessage { return { id: crypto.randomUUID(), role: "assistant", content: "", images: images.filter((img): img is GeneratedImage & { url: string } => typeof img.url === "string").map((img): ChatImage => ({ id: img.id || crypto.randomUUID(), ...(img.id ? { serverImageId: img.id } : {}), url: img.url, prompt: img.prompt ?? "" })) }; }
  /** Sends the composer text, or the given text (talk mode, voice typing); resolves to the reply text (null if nothing was answered). `voice` asks for a short, speakable reply. */
  async function send(spoken?: unknown, options: { voice?: boolean } = {}): Promise<string | null> { const direct = typeof spoken === "string"; const fromVoice = options.voice === true; const text = direct ? spoken.trim() : input.trim(); if (!text || !activeConversation || loadingConversationId) return null; const conversationId = activeId; const controller = new AbortController(); setAssistantActivity("request", true); setInput(""); setConversationLoading(conversationId, true); const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text }; const nextMessages = [...activeConversation.messages, userMessage]; const assistantMessageId = crypto.randomUUID(); activeStreams.current.set(conversationId, { controller, assistantId: assistantMessageId }); updateConversation(conversationId, (c) => ({ ...c, messages: nextMessages })); try { const result = await sendMessage(nextMessages, settings.personality, undefined, settings.memory, conversationId, (token) => { setAssistantActivity("stream", true); updateConversation(conversationId, (conversation) => { const exists = conversation.messages.some((message) => message.id === assistantMessageId); const messages = exists ? conversation.messages.map((message) => message.id === assistantMessageId ? { ...message, content: message.content + token, streaming: true } : message) : [...conversation.messages, { id: assistantMessageId, role: "assistant" as const, content: token, streaming: true }]; return { ...conversation, messages }; }); }, controller.signal, assistantMessageId, fromVoice);  let aiMessage: ChatMessage; if (result.imagePrompt) { setConversationImageGenerating(conversationId, true); try { const generated = await generateImage(result.imagePrompt, [], controller.signal); aiMessage = imageMessage(generated.images); } finally { setConversationImageGenerating(conversationId, false); } } else { aiMessage = { id: assistantMessageId, role: "assistant", content: typeof result.reply === "string" ? result.reply : "", ...liveAndApproval(result) }; setLastReplyId(assistantMessageId); } updateConversation(conversationId, (c) => ({ ...c, title: activeConversation.messages.length === 0 ? result.title || c.title : c.title, messages: [...nextMessages, aiMessage] })); if (!result.imagePrompt && aiMessage.content.trim()) void addVisuals(conversationId, aiMessage.id, text); if (activeConversation.messages.length === 0 && (result.imagePrompt ? aiMessage.images?.length : aiMessage.content.trim())) { const titleIt = () => void autoTitleConversation(conversationId).then((title) => { if (title) updateConversation(conversationId, (c) => ({ ...c, title })); }).catch(() => undefined); /* picture chats are saved a moment later by the autosave */ if (result.imagePrompt) window.setTimeout(titleIt, 2_000); else titleIt(); } return aiMessage.content; } catch (error) { if (error instanceof Error && error.name === "AbortError") { updateConversation(conversationId, (c) => ({ ...c, messages: c.messages.map((m) => m.id === assistantMessageId ? { ...m, streaming: false } : m) })); return null; } /* The connection dropped or stalled: the server keeps writing and saves the reply, so fetch it instead of losing it. */ const recovered = await recoverReply(conversationId, assistantMessageId); if (recovered) return recovered; updateConversation(conversationId, (c) => ({ ...c, messages: [...c.messages.map((m) => m.id === assistantMessageId ? { ...m, streaming: false, incomplete: m.content.trim() ? true : m.incomplete } : m).filter((message) => message.id !== assistantMessageId || message.content.trim()), { id: crypto.randomUUID(), role: "assistant", content: error instanceof Error ? error.message : "The AI request failed. Please try again." }] })); return null; } finally { if (activeStreams.current.get(conversationId)?.controller === controller) activeStreams.current.delete(conversationId); setAssistantActivity("request", activeStreams.current.size > 0); setAssistantActivity("stream", activeStreams.current.size > 0); setConversationLoading(conversationId, false); } } function stop() { const active = activeStreams.current.get(activeId); if (!active) return; active.controller.abort(); void cancelGeneration(active.assistantId); }
  async function handleFiles(files: File[]) {
    if (!activeConversation || !files.length) return;
    setConversationLoading(activeId, true);
    setAssistantActivity("request", true);
    let workingMessages = activeConversation.messages;
    try {
      for (let file of files) {
        const uploadKey = `${file.name}:${file.size}:${file.lastModified}`;
        const uploadController = new AbortController();
        uploadControllers.current.set(uploadKey, uploadController);
        setUploadingFiles((prev) => [...prev, uploadKey]);
        setUploadProgress((prev) => ({ ...prev, [uploadKey]: 0 }));
        try {
          if (file.type.startsWith("image/") && !["image/png", "image/jpeg", "image/webp"].includes(file.type.toLowerCase())) throw new Error("Pictures need to be PNG, JPEG or WebP. (iPhone HEIC photos: share them as JPEG.)");
          // Phone photos are 3-5 MB; shrink them in the browser so they fit the upload and image-understanding limits.
          const original = file;
          file = file.type.startsWith("image/") ? await shrinkImage(file) : file;
          if (file.size > MAX_UPLOAD_BYTES) throw new Error(`That file is ${(original.size / 1024 / 1024).toFixed(1)} MB. Files up to 4 MB work here. Try a smaller file, or copy the text into the chat.`);
          const result = await uploadFile(file, (progress) => setUploadProgress((prev) => ({ ...prev, [uploadKey]: progress })), uploadController.signal);
          const fileData: ChatFile = { id: crypto.randomUUID(), name: result.name, type: result.type, text: result.text };
          if (uploadController.signal.aborted) throw Object.assign(new Error("Upload cancelled."), { name: "AbortError" });
          if (file.type.startsWith("image/")) {
            const image: ChatImage = { id: crypto.randomUUID(), url: await readImageDataUrl(file), prompt: file.name };
            const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: "Please analyze this image: " + file.name, files: [fileData], images: [image] };
            const nextMessages = [...workingMessages, userMessage];
            updateConversation(activeId, (conversation) => ({ ...conversation, messages: nextMessages }));
            const assistantId = crypto.randomUUID();
            const response = await sendMessage(nextMessages, settings.personality, undefined, settings.memory, activeId, undefined, uploadController.signal, assistantId);
            setLastReplyId(assistantId);
            const assistantMessage: ChatMessage = { id: assistantId, role: "assistant", content: typeof response.reply === "string" ? response.reply : "Image analysis finished without a text response." };
            workingMessages = [...nextMessages, assistantMessage];
            updateConversation(activeId, (conversation) => ({ ...conversation, title: response.title || conversation.title, messages: workingMessages }));
            continue;
          }
          const nextMessages = [...workingMessages, { id: crypto.randomUUID(), role: "user" as const, content: "", files: [fileData] }];
          updateConversation(activeId, (conversation) => ({ ...conversation, messages: nextMessages }));
          const filePrompt = "file content from " + result.name + ":\n\n" + result.text;
          const assistantId = crypto.randomUUID();
          const response = await sendMessage([...nextMessages, { id: crypto.randomUUID(), role: "user", content: filePrompt, ephemeral: true }], settings.personality, undefined, settings.memory, activeId, undefined, uploadController.signal, assistantId);
          setLastReplyId(assistantId);
          const assistantMessage: ChatMessage = { id: assistantId, role: "assistant", content: typeof response.reply === "string" ? response.reply : "The AI returned no text response." };
          workingMessages = [...nextMessages, assistantMessage];
          updateConversation(activeId, (conversation) => ({ ...conversation, title: response.title || conversation.title, messages: workingMessages }));
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") continue;
          const message = error instanceof Error ? error.message : "The file could not be processed. Please try again.";
          const errorMessage: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: message };
          workingMessages = [...workingMessages, errorMessage];
          updateConversation(activeId, (conversation) => ({ ...conversation, messages: [...conversation.messages, errorMessage] }));
        } finally {
          uploadControllers.current.delete(uploadKey);
          setUploadingFiles((prev) => prev.filter((name) => name !== uploadKey));
          setUploadProgress((prev) => { const next = { ...prev }; delete next[uploadKey]; return next; });
        }
      }
    } finally { setAssistantActivity("request", activeStreams.current.size > 0); setConversationLoading(activeId, false); }
  }
  async function regenerateLastAssistant() {
    if (!activeConversation || loadingConversationIds.has(activeId)) return;
    const messages = activeConversation.messages;
    const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    if (!lastAssistant) return;
    const withoutAssistant = messages.filter((message) => message.id !== lastAssistant.id);
    const controller = new AbortController();
    const regeneratedId = crypto.randomUUID();
    activeStreams.current.set(activeId, { controller, assistantId: regeneratedId });
    setAssistantActivity("request", true);
    setConversationLoading(activeId, true);
    updateConversation(activeId, (conversation) => ({ ...conversation, messages: withoutAssistant }));
    void deleteRemoteMessage(activeId, lastAssistant.id).catch(() => undefined);
    try {
      const result = await sendMessage(withoutAssistant, settings.personality, undefined, settings.memory, activeId, undefined, controller.signal, regeneratedId);
      let aiMessage: ChatMessage;
      if (result.imagePrompt) {
        setConversationImageGenerating(activeId, true);
        try {
          const generated = await generateImage(result.imagePrompt, [], controller.signal);
          aiMessage = imageMessage(generated.images);
        } finally {
          setConversationImageGenerating(activeId, false);
        }
      } else {
        aiMessage = { id: regeneratedId, role: "assistant", content: result.reply ?? "", ...liveAndApproval(result) };
        setLastReplyId(regeneratedId);
      }
      updateConversation(activeId, (conversation) => ({ ...conversation, title: conversation.title, messages: [...withoutAssistant, aiMessage] }));
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        const message = error instanceof Error ? error.message : "The response could not be regenerated. Please try again.";
        updateConversation(activeId, (conversation) => ({ ...conversation, messages: [...withoutAssistant, { id: crypto.randomUUID(), role: "assistant", content: message }] }));
      }
    } finally {
      if (activeStreams.current.get(activeId)?.controller === controller) activeStreams.current.delete(activeId);
      setAssistantActivity("request", activeStreams.current.size > 0);
      setConversationImageGenerating(activeId, false);
      setConversationLoading(activeId, false);
    }
  }
  function newChat() { if (activeConversation && activeConversation.messages.length === 0) { setInput(""); return; } const convo = createConversation(); setConversations((prev) => [convo, ...prev.filter((conversation) => conversation.messages.length > 0)]); setActiveId(convo.id); setInput(""); } function togglePin(id: string) { const current = conversations.find((conversation) => conversation.id === id); if (!current) return; const pinned = !current.pinned; updateConversation(id, (c) => ({ ...c, pinned })); void updateRemoteConversation(id, { isPinned: pinned }).catch(() => undefined); } function togglePinMessage(conversationId: string, messageId: string) { updateConversation(conversationId, (c) => ({ ...c, messages: c.messages.map((m) => m.id === messageId ? { ...m, pinned: !m.pinned } : m) })); } /** After a dropped connection: waits for the server to finish the reply it kept writing, then shows the saved version. */
  async function recoverReply(conversationId: string, messageId: string): Promise<string | null> {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 2_500));
      const saved = await fetchSavedReply(conversationId, messageId).catch(() => null);
      if (!saved) continue;
      if (saved.content.trim()) updateConversation(conversationId, (c) => ({ ...c, messages: c.messages.some((m) => m.id === messageId) ? c.messages.map((m) => m.id === messageId ? { ...m, content: saved.content, streaming: !["completed", "incomplete", "failed", "cancelled"].includes(saved.status) } : m) : [...c.messages, { id: messageId, role: "assistant" as const, content: saved.content, streaming: true }] }));
      if (saved.status === "completed" || saved.status === "incomplete") {
        updateConversation(conversationId, (c) => ({ ...c, messages: c.messages.map((m) => m.id === messageId ? { ...m, streaming: false, ...(saved.status === "incomplete" ? { incomplete: true } : {}) } : m) }));
        return saved.content.trim() ? saved.content : null;
      }
      if (saved.status === "failed" || saved.status === "cancelled") return null;
    }
    return null;
  }
  /** Add relevant reference pictures after explanatory or idea questions. Never generate artwork automatically. */
  async function addVisuals(conversationId: string, messageId: string, question: string) {
    if (!loadPreferences().visualAnswers) return;
    const kind = visualKind(question);
    if (!kind) return;
    const topic = topicOf(question);
    const googleImagesUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(topic)}`;
    const patch = (changes: Partial<ChatMessage>) => updateConversation(conversationId, (c) => ({ ...c, messages: c.messages.map((m) => m.id === messageId ? { ...m, ...changes } : m) }));
    patch({ visualPending: true, googleImagesUrl });
    try {
      const pictures = await searchPictures(topic).catch(() => []);
      patch({ gallery: pictures.slice(0, 6), visualPending: false });
    } catch { patch({ visualPending: false }); }
  }
  /** Makes a read-only share link for a chat, copies it, and remembers that the chat is shared. */
  async function shareChat(id: string) { const token = await shareConversation(id); updateConversation(id, (c) => ({ ...c, shareToken: token })); const url = `${window.location.origin}/share/${token}`; try { await navigator.clipboard.writeText(url); } catch { /* the caller shows the link */ } return url; }
  async function unshareChat(id: string) { await unshareConversation(id); updateConversation(id, (c) => { const next = { ...c }; delete next.shareToken; return next; }); }
  /** Edit your latest question: it goes back into the box, and it and everything after it are removed, so you can fix it and resend. */
  function editLastUserMessage(conversationId: string, messageId: string) { const conversation = conversations.find((item) => item.id === conversationId); if (!conversation || loadingConversationIds.has(conversationId)) return; const index = conversation.messages.findIndex((m) => m.id === messageId); const lastUser = [...conversation.messages].reverse().find((m) => m.role === "user"); if (index < 0 || lastUser?.id !== messageId) return; const removed = conversation.messages.slice(index); updateConversation(conversationId, (c) => ({ ...c, messages: c.messages.slice(0, index) })); for (const message of removed) void deleteRemoteMessage(conversationId, message.id).catch(() => undefined); setInput(conversation.messages[index].content); window.setTimeout(() => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message Jarvis"]')?.focus(), 50); }
  function deleteMessage(conversationId: string, messageId: string) { updateConversation(conversationId, (c) => ({ ...c, messages: c.messages.filter((m) => m.id !== messageId) })); void deleteRemoteMessage(conversationId, messageId).catch(() => undefined); } function renameConversation(id: string, title: string) { const next = title.trim().slice(0, 200); if (next) { updateConversation(id, (c) => ({ ...c, title: next })); void updateRemoteConversation(id, { title: next }).catch(() => undefined); } } function deleteConversation(id: string) { const target = conversations.find((conversation) => conversation.id === id); void deleteRemoteConversation(id).then(() => { setConversations((prev) => { const next = prev.filter((conversation) => conversation.id !== id); if (id === activeId) setActiveId(next[0]?.id || ""); return next; }); }).catch(() => { if (target) updateConversation(id, (conversation) => ({ ...conversation, messages: [...conversation.messages, { id: crypto.randomUUID(), role: "assistant", content: "This conversation could not be deleted from the server. Please try again." }] })); }); }
  function cancelUpload(uploadKey: string) { uploadControllers.current.get(uploadKey)?.abort(); }
  function setApproval(conversationId: string, messageId: string, patch: Partial<ToolApproval>) {
    updateConversation(conversationId, (conversation) => ({ ...conversation, messages: conversation.messages.map((message) => message.id === messageId && message.approval ? { ...message, approval: { ...message.approval, ...patch } } : message) }));
  }
  /** Runs (or declines) a tool call only after the user clicks Approve; the server issues a one-time token. */
  async function resolveApproval(messageId: string, approve: boolean) {
    const conversationId = activeId;
    const message = activeConversation?.messages.find((item) => item.id === messageId);
    const approval = message?.approval;
    if (!approval || approval.state !== "pending") return;
    if (!approve) { setApproval(conversationId, messageId, { state: "declined" }); return; }
    setApproval(conversationId, messageId, { state: "running" });
    try {
      const output = await approveAndRunTool(approval.tool, approval.workspaceId, approval.arguments);
      setApproval(conversationId, messageId, { state: "completed" });
      updateConversation(conversationId, (conversation) => ({ ...conversation, messages: [...conversation.messages, { id: crypto.randomUUID(), role: "assistant", content: `**${approval.name}** finished.\n\n\`\`\`json\n${output.slice(0, 8_000) || "{}"}\n\`\`\`` }] }));
    } catch (error) {
      setApproval(conversationId, messageId, { state: "failed", error: error instanceof Error ? error.message : "The tool failed." });
    }
  }
  return { lastReplyId, shareChat, unshareChat, editLastUserMessage, resolveApproval, conversations, visibleConversations, activeConversation, activeId, setActiveId, input, setInput, search, setSearch, loading: Boolean(loadingConversationId), streaming, generatingImage, stop, uploadingFiles, uploadProgress, cancelUpload, settings, setSettings, send, handleFiles, regenerateLastAssistant, newChat, togglePin, togglePinMessage, deleteMessage, renameConversation, deleteConversation };
}
