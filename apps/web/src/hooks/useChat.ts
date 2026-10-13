"use client";
import { useEffect, useMemo, useState } from "react";
import { deleteConversation as deleteRemoteConversation, generateImage, listConversations, saveConversation, sendMessage, updateConversation as updateRemoteConversation, uploadFile } from "@/lib/api";
import type { Conversation, ChatMessage, ChatImage, ChatFile } from "@/types/chat";
const STORAGE_KEY = "bobai.conversation-ui.v3";
const LEGACY_STORAGE_KEY = "bobai.conversations.v2";
const SETTINGS_KEY = "bobai.settings.v1";
type GeneratedImage = { url: string; prompt?: string }; type ImageResponse = { images: GeneratedImage[] };
type ChatSettings = { personality: string; memory?: boolean };
function readImageDataUrl(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("The image could not be read.")); reader.onerror = () => reject(new Error("The image could not be read.")); reader.readAsDataURL(file); }); }
function createConversation(): Conversation { return { id: crypto.randomUUID(), title: "new chat", createdAt: Date.now(), pinned: false, messages: [] }; }
function loadSettings(): ChatSettings { if (typeof window === "undefined") return { personality: "" }; try { const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); return { personality: typeof parsed?.personality === "string" ? parsed.personality : "", memory: parsed?.memory !== false }; } catch { return { personality: "" }; } }
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
export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]); const [activeId, setActiveId] = useState(""); const [input, setInput] = useState(""); const [search, setSearch] = useState(""); const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null); const [settings, setSettings] = useState<ChatSettings>(loadSettings); const [uploadingFiles, setUploadingFiles] = useState<string[]>([]); const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({}); const [serverReady, setServerReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const localConversations = loadLocalConversationUi();
    const initial = localConversations.length ? localConversations : [createConversation()];
    setConversations(initial);
    setActiveId(initial[0].id);
    void listConversations().then((remote) => {
      if (cancelled) return;
      if (remote.length) {
        const localById = new Map(localConversations.map((conversation) => [conversation.id, conversation]));
        const merged = remote.map((conversation) => ({ ...conversation, pinned: localById.get(conversation.id)?.pinned ?? false }));
        setConversations(merged);
        setActiveId(merged[0]?.id || "");
      } else {
        for (const conversation of initial) void saveConversation(conversation).catch(() => undefined);
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
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);
  useEffect(() => { if (!serverReady || !conversations.length) return; const timer = window.setTimeout(() => { for (const conversation of conversations) void saveConversation(conversation).catch(() => undefined); }, 500); return () => window.clearTimeout(timer); }, [conversations, serverReady]);
  const activeConversation = conversations.find((c) => c.id === activeId); const visibleConversations = useMemo(() => conversations.filter((c) => c.title.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : b.createdAt - a.createdAt), [conversations, search]);
  function updateConversation(id: string, updater: (c: Conversation) => Conversation) { setConversations((prev) => prev.map((c) => c.id === id ? updater(c) : c)); }
  function imageMessage(images: GeneratedImage[]): ChatMessage { return { id: crypto.randomUUID(), role: "assistant", content: "", images: images.filter((img): img is GeneratedImage & { url: string } => typeof img.url === "string").map((img): ChatImage => ({ id: crypto.randomUUID(), url: img.url, prompt: img.prompt ?? "" })) }; }
  async function send() { const text = input.trim(); if (!text || !activeConversation || loadingConversationId) return; const conversationId = activeId; setInput(""); setLoadingConversationId(conversationId); const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text }; const nextMessages = [...activeConversation.messages, userMessage]; const assistantMessageId = crypto.randomUUID(); updateConversation(conversationId, (c) => ({ ...c, messages: nextMessages })); try { const result = await sendMessage(nextMessages, settings.personality, undefined, settings.memory, conversationId, (token) => updateConversation(conversationId, (conversation) => { const exists = conversation.messages.some((message) => message.id === assistantMessageId); const messages = exists ? conversation.messages.map((message) => message.id === assistantMessageId ? { ...message, content: message.content + token } : message) : [...conversation.messages, { id: assistantMessageId, role: "assistant" as const, content: token }]; return { ...conversation, messages }; })); const aiMessage = result.imagePrompt ? imageMessage(((await generateImage(result.imagePrompt)) as ImageResponse).images) : { id: assistantMessageId, role: "assistant" as const, content: typeof result.reply === "string" ? result.reply : "" }; updateConversation(conversationId, (c) => ({ ...c, title: result.title || c.title, messages: [...nextMessages, aiMessage] })); } catch (error) { updateConversation(conversationId, (c) => ({ ...c, messages: [...nextMessages, { id: crypto.randomUUID(), role: "assistant", content: error instanceof Error ? error.message : "The AI request failed. Please try again." }] })); } finally { setLoadingConversationId(null); } }
  async function handleFiles(files: File[]) {
    if (!activeConversation || !files.length) return;
    setLoadingConversationId(activeId);
    let workingMessages = activeConversation.messages;
    try {
      for (const file of files) {
        setUploadingFiles((prev) => [...prev, file.name]);
        setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));
        try {
          if (file.type.startsWith("image/") && !["image/png", "image/jpeg", "image/webp"].includes(file.type.toLowerCase())) throw new Error("Image understanding currently supports PNG, JPEG, and WebP images.");
          if (file.type.startsWith("image/") && file.size > 1_000_000) throw new Error("For image understanding, attach an image smaller than 1 MB for now.");
          const result = await uploadFile(file, (progress) => setUploadProgress((prev) => ({ ...prev, [file.name]: progress })));
          const fileData: ChatFile = { id: crypto.randomUUID(), name: result.name, type: result.type, text: result.text };
          if (file.type.startsWith("image/")) {
            const image: ChatImage = { id: crypto.randomUUID(), url: await readImageDataUrl(file), prompt: file.name };
            const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: "Please analyze this image: " + file.name, files: [fileData], images: [image] };
            const nextMessages = [...workingMessages, userMessage];
            updateConversation(activeId, (conversation) => ({ ...conversation, messages: nextMessages }));
            const response = await sendMessage(nextMessages, settings.personality, undefined, settings.memory, activeId);
            const assistantMessage: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: typeof response.reply === "string" ? response.reply : "Image analysis finished without a text response." };
            workingMessages = [...nextMessages, assistantMessage];
            updateConversation(activeId, (conversation) => ({ ...conversation, title: response.title || conversation.title, messages: workingMessages }));
            continue;
          }
          const nextMessages = [...workingMessages, { id: crypto.randomUUID(), role: "user" as const, content: "", files: [fileData] }];
          updateConversation(activeId, (conversation) => ({ ...conversation, messages: nextMessages }));
          const filePrompt = "file content from " + result.name + ":\n\n" + result.text;
          const response = await sendMessage([...nextMessages, { id: crypto.randomUUID(), role: "user", content: filePrompt }], settings.personality, undefined, settings.memory, activeId);
          const assistantMessage: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: typeof response.reply === "string" ? response.reply : "The AI returned no text response." };
          workingMessages = [...nextMessages, assistantMessage];
          updateConversation(activeId, (conversation) => ({ ...conversation, title: response.title || conversation.title, messages: workingMessages }));
        } catch (error) {
          const message = error instanceof Error ? error.message : "The file could not be processed. Please try again.";
          const errorMessage: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: message };
          workingMessages = [...workingMessages, errorMessage];
          updateConversation(activeId, (conversation) => ({ ...conversation, messages: [...conversation.messages, errorMessage] }));
        } finally {
          setUploadingFiles((prev) => prev.filter((name) => name !== file.name));
          setUploadProgress((prev) => { const next = { ...prev }; delete next[file.name]; return next; });
        }
      }
    } finally { setLoadingConversationId(null); }
  }
  async function regenerateLastAssistant() {
    if (!activeConversation || loadingConversationId) return;
    const messages = activeConversation.messages;
    const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    if (!lastAssistant) return;
    const withoutAssistant = messages.filter((message) => message.id !== lastAssistant.id);
    setLoadingConversationId(activeId);
    updateConversation(activeId, (conversation) => ({ ...conversation, messages: withoutAssistant }));
    try {
      const result = await sendMessage(withoutAssistant, settings.personality, undefined, settings.memory, activeId);
      const aiMessage = result.imagePrompt ? imageMessage(((await generateImage(result.imagePrompt)) as ImageResponse).images) : { id: crypto.randomUUID(), role: "assistant" as const, content: result.reply };
      updateConversation(activeId, (conversation) => ({ ...conversation, title: result.title || conversation.title, messages: [...withoutAssistant, aiMessage] }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "The response could not be regenerated. Please try again.";
      updateConversation(activeId, (conversation) => ({ ...conversation, messages: [...withoutAssistant, { id: crypto.randomUUID(), role: "assistant", content: message }] }));
    } finally { setLoadingConversationId(null); }
  }
  function newChat() { const convo = createConversation(); setConversations((prev) => [convo, ...prev]); setActiveId(convo.id); setInput(""); } function togglePin(id: string) { const current = conversations.find((conversation) => conversation.id === id); if (!current) return; const pinned = !current.pinned; updateConversation(id, (c) => ({ ...c, pinned })); void updateRemoteConversation(id, { isPinned: pinned }).catch(() => undefined); } function togglePinMessage(conversationId: string, messageId: string) { updateConversation(conversationId, (c) => ({ ...c, messages: c.messages.map((m) => m.id === messageId ? { ...m, pinned: !m.pinned } : m) })); } function deleteMessage(conversationId: string, messageId: string) { updateConversation(conversationId, (c) => ({ ...c, messages: c.messages.filter((m) => m.id !== messageId) })); } function renameConversation(id: string, title: string) { const next = title.trim().slice(0, 200); if (next) { updateConversation(id, (c) => ({ ...c, title: next })); void updateRemoteConversation(id, { title: next }).catch(() => undefined); } } function deleteConversation(id: string) { setConversations((prev) => { const next = prev.filter((c) => c.id !== id); if (id === activeId) setActiveId(next[0]?.id || ""); return next; }); void deleteRemoteConversation(id).catch(() => undefined); }
  return { conversations, visibleConversations, activeConversation, activeId, setActiveId, input, setInput, search, setSearch, loading: Boolean(loadingConversationId), uploadingFiles, uploadProgress, settings, setSettings, send, handleFiles, regenerateLastAssistant, newChat, togglePin, togglePinMessage, deleteMessage, renameConversation, deleteConversation };
}
