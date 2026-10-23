"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { setAssistantActivity } from "@/lib/assistantState";
import { loadPreferences } from "@/lib/preferences";
import { approveAndRunTool, autoTitleConversation, deleteRemoteMessage, deleteConversation as deleteRemoteConversation, generateImage, listConversations, saveConversation, sendMessage, updateConversation as updateRemoteConversation, uploadFile } from "@/lib/api";
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
function liveAndApproval(result: Record<string, unknown>): Pick<ChatMessage, "liveData" | "approval" | "model"> {
  const live = result.liveData as LiveDataInfo | undefined;
  const approval = result.approval as Omit<ToolApproval, "state"> | undefined;
  // The Ollama model that actually answered, shown under the reply.
  const model = typeof result.model === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}$/.test(result.model) && !["bob", "coding-agent"].includes(result.model) ? result.model : undefined;
  return {
    ...(model ? { model } : {}),
    ...(live && typeof live.provider === "string" ? { liveData: { ...live, sources: Array.isArray(live.sources) ? live.sources.filter((source) => typeof source?.url === "string" && /^https?:\/\//.test(source.url)) : [] } } : {}),
    ...(approval && typeof approval.tool === "string" && typeof approval.workspaceId === "string" ? { approval: { ...approval, arguments: approval.arguments && typeof approval.arguments === "object" ? approval.arguments : {}, state: "pending" as const } } : {}),
  };
}
export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]); const [activeId, setActiveId] = useState(""); const [input, setInput] = useState(""); const [search, setSearch] = useState(""); const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null); const [settings, setSettings] = useState<ChatSettings>(loadSettings); const [uploadingFiles, setUploadingFiles] = useState<string[]>([]); const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({}); const [serverReady, setServerReady] = useState(false); const [streaming, setStreaming] = useState(false); const [generatingImage, setGeneratingImage] = useState(false); const activeStream = useRef<AbortController | null>(null); /** The reply produced in this page session that voice replies may speak; old replies are never auto-played. */ const [lastReplyId, setLastReplyId] = useState<string | null>(null); const uploadControllers = useRef(new Map<string, AbortController>());
  useEffect(() => () => { activeStream.current?.abort(); for (const controller of uploadControllers.current.values()) controller.abort(); uploadControllers.current.clear(); }, []);
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
  function imageMessage(images: GeneratedImage[]): ChatMessage { return { id: crypto.randomUUID(), role: "assistant", content: "", images: images.filter((img): img is GeneratedImage & { url: string } => typeof img.url === "string").map((img): ChatImage => ({ id: img.id || crypto.randomUUID(), ...(img.id ? { serverImageId: img.id } : {}), url: img.url, prompt: img.prompt ?? "" })) }; }
  async function send() { const text = input.trim(); if (!text || !activeConversation || loadingConversationId) return; const conversationId = activeId; const controller = new AbortController(); activeStream.current = controller; setStreaming(true); setAssistantActivity("request", true); setInput(""); setLoadingConversationId(conversationId); const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text }; const nextMessages = [...activeConversation.messages, userMessage]; const assistantMessageId = crypto.randomUUID(); updateConversation(conversationId, (c) => ({ ...c, messages: nextMessages })); try { const result = await sendMessage(nextMessages, settings.personality, undefined, settings.memory, conversationId, (token) => { setAssistantActivity("stream", true); updateConversation(conversationId, (conversation) => { const exists = conversation.messages.some((message) => message.id === assistantMessageId); const messages = exists ? conversation.messages.map((message) => message.id === assistantMessageId ? { ...message, content: message.content + token } : message) : [...conversation.messages, { id: assistantMessageId, role: "assistant" as const, content: token }]; return { ...conversation, messages }; }); }, controller.signal, assistantMessageId);  let aiMessage: ChatMessage; if (result.imagePrompt) { setGeneratingImage(true); try { const generated = await generateImage(result.imagePrompt, [], controller.signal); aiMessage = imageMessage(generated.images); } finally { setGeneratingImage(false); } } else { aiMessage = { id: assistantMessageId, role: "assistant", content: typeof result.reply === "string" ? result.reply : "", ...liveAndApproval(result) }; setLastReplyId(assistantMessageId); } updateConversation(conversationId, (c) => ({ ...c, title: result.title || c.title, messages: [...nextMessages, aiMessage] })); if (activeConversation.messages.length === 0 && !result.imagePrompt && aiMessage.content.trim()) void autoTitleConversation(conversationId).then((title) => { if (title) updateConversation(conversationId, (c) => ({ ...c, title })); }).catch(() => undefined); } catch (error) { if (!(error instanceof Error && error.name === "AbortError")) updateConversation(conversationId, (c) => ({ ...c, messages: [...c.messages.filter((message) => message.id !== assistantMessageId || message.content.trim()), { id: crypto.randomUUID(), role: "assistant", content: error instanceof Error ? error.message : "The AI request failed. Please try again." }] })); } finally { if (activeStream.current === controller) activeStream.current = null; setStreaming(false); setAssistantActivity("request", false); setAssistantActivity("stream", false); setLoadingConversationId(null); } } function stop() { activeStream.current?.abort(); }
  async function handleFiles(files: File[]) {
    if (!activeConversation || !files.length) return;
    setLoadingConversationId(activeId);
    setAssistantActivity("request", true);
    let workingMessages = activeConversation.messages;
    try {
      for (const file of files) {
        const uploadKey = `${file.name}:${file.size}:${file.lastModified}`;
        const uploadController = new AbortController();
        uploadControllers.current.set(uploadKey, uploadController);
        setUploadingFiles((prev) => [...prev, uploadKey]);
        setUploadProgress((prev) => ({ ...prev, [uploadKey]: 0 }));
        try {
          if (file.type.startsWith("image/") && !["image/png", "image/jpeg", "image/webp"].includes(file.type.toLowerCase())) throw new Error("Image understanding currently supports PNG, JPEG, and WebP images.");
          if (file.type.startsWith("image/") && file.size > 1_000_000) throw new Error("For image understanding, attach an image smaller than 1 MB for now.");
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
    } finally { setAssistantActivity("request", false); setLoadingConversationId(null); }
  }
  async function regenerateLastAssistant() {
    if (!activeConversation || loadingConversationId) return;
    const messages = activeConversation.messages;
    const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    if (!lastAssistant) return;
    const withoutAssistant = messages.filter((message) => message.id !== lastAssistant.id);
    const controller = new AbortController();
    activeStream.current = controller;
    setStreaming(true);
    setAssistantActivity("request", true);
    setLoadingConversationId(activeId);
    updateConversation(activeId, (conversation) => ({ ...conversation, messages: withoutAssistant }));
    void deleteRemoteMessage(activeId, lastAssistant.id).catch(() => undefined);
    try {
      const regeneratedId = crypto.randomUUID();
      const result = await sendMessage(withoutAssistant, settings.personality, undefined, settings.memory, activeId, undefined, controller.signal, regeneratedId);
      let aiMessage: ChatMessage;
      if (result.imagePrompt) {
        setGeneratingImage(true);
        try {
          const generated = await generateImage(result.imagePrompt, [], controller.signal);
          aiMessage = imageMessage(generated.images);
        } finally {
          setGeneratingImage(false);
        }
      } else {
        aiMessage = { id: regeneratedId, role: "assistant", content: result.reply ?? "", ...liveAndApproval(result) };
        setLastReplyId(regeneratedId);
      }
      updateConversation(activeId, (conversation) => ({ ...conversation, title: result.title || conversation.title, messages: [...withoutAssistant, aiMessage] }));
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        const message = error instanceof Error ? error.message : "The response could not be regenerated. Please try again.";
        updateConversation(activeId, (conversation) => ({ ...conversation, messages: [...withoutAssistant, { id: crypto.randomUUID(), role: "assistant", content: message }] }));
      }
    } finally {
      if (activeStream.current === controller) activeStream.current = null;
      setStreaming(false);
      setAssistantActivity("request", false);
      setGeneratingImage(false);
      setLoadingConversationId(null);
    }
  }
  function newChat() { if (activeConversation && activeConversation.messages.length === 0) { setInput(""); return; } const convo = createConversation(); setConversations((prev) => [convo, ...prev.filter((conversation) => conversation.messages.length > 0)]); setActiveId(convo.id); setInput(""); } function togglePin(id: string) { const current = conversations.find((conversation) => conversation.id === id); if (!current) return; const pinned = !current.pinned; updateConversation(id, (c) => ({ ...c, pinned })); void updateRemoteConversation(id, { isPinned: pinned }).catch(() => undefined); } function togglePinMessage(conversationId: string, messageId: string) { updateConversation(conversationId, (c) => ({ ...c, messages: c.messages.map((m) => m.id === messageId ? { ...m, pinned: !m.pinned } : m) })); } function deleteMessage(conversationId: string, messageId: string) { updateConversation(conversationId, (c) => ({ ...c, messages: c.messages.filter((m) => m.id !== messageId) })); void deleteRemoteMessage(conversationId, messageId).catch(() => undefined); } function renameConversation(id: string, title: string) { const next = title.trim().slice(0, 200); if (next) { updateConversation(id, (c) => ({ ...c, title: next })); void updateRemoteConversation(id, { title: next }).catch(() => undefined); } } function deleteConversation(id: string) { const target = conversations.find((conversation) => conversation.id === id); void deleteRemoteConversation(id).then(() => { setConversations((prev) => { const next = prev.filter((conversation) => conversation.id !== id); if (id === activeId) setActiveId(next[0]?.id || ""); return next; }); }).catch(() => { if (target) updateConversation(id, (conversation) => ({ ...conversation, messages: [...conversation.messages, { id: crypto.randomUUID(), role: "assistant", content: "This conversation could not be deleted from the server. Please try again." }] })); }); }
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
  return { lastReplyId, resolveApproval, conversations, visibleConversations, activeConversation, activeId, setActiveId, input, setInput, search, setSearch, loading: Boolean(loadingConversationId), streaming, generatingImage, stop, uploadingFiles, uploadProgress, cancelUpload, settings, setSettings, send, handleFiles, regenerateLastAssistant, newChat, togglePin, togglePinMessage, deleteMessage, renameConversation, deleteConversation };
}
