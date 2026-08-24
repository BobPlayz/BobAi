"use client";

import { useEffect, useMemo, useState } from "react";
import { sendMessage, generateImage, uploadFile } from "@/lib/api";
import type {
  Conversation,
  ChatMessage,
  ChatImage,
  ChatFile,
} from "@/types/chat";

const STORAGE_KEY = "bobai.conversations.v2";
const SETTINGS_KEY = "bobai.settings.v1";

function createConversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    title: "new chat",
    createdAt: Date.now(),
    pinned: false,
    messages: [],
  };
}

function loadSettings() {
  if (typeof window === "undefined") {
    return { personality: "" };
  }

  try {
    return JSON.parse(
      localStorage.getItem(SETTINGS_KEY) || "{}"
    );
  } catch {
    return { personality: "" };
  }
}

export function useChat() {
  const [conversations, setConversations] = useState<
    Conversation[]
  >([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [
    loadingConversationId,
    setLoadingConversationId,
  ] = useState<string | null>(null);
  const [settings, setSettings] =
    useState(loadSettings);

  const [uploadingFiles, setUploadingFiles] =
    useState<string[]>([]);
  const [uploadProgress, setUploadProgress] =
    useState<Record<string, number>>({});

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      try {
        const data = JSON.parse(saved) as Conversation[];

        if (data.length) {
          setConversations(data);
          setActiveId(data[0].id);
          return;
        }
      } catch {}
    }

    const first = createConversation();
    setConversations([first]);
    setActiveId(first.id);
  }, []);

  useEffect(() => {
    if (conversations.length) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(conversations)
      );
    }
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify(settings)
    );
  }, [settings]);

  const activeConversation = conversations.find(
    (c) => c.id === activeId
  );

  const visibleConversations = useMemo(() => {
    return conversations
      .filter((c) =>
        c.title
          .toLowerCase()
          .includes(search.toLowerCase())
      )
      .sort((a, b) => {
        if (a.pinned !== b.pinned) {
          return a.pinned ? -1 : 1;
        }

        return b.createdAt - a.createdAt;
      });
  }, [conversations, search]);

  function updateConversation(
    id: string,
    updater: (c: Conversation) => Conversation
  ) {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? updater(c) : c))
    );
  }

  async function send() {
    const text = input.trim();

    if (
      !text ||
      !activeConversation ||
      loadingConversationId
    ) {
      return;
    }

    const conversationId = activeId;

    setInput("");
    setLoadingConversationId(conversationId);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    const nextMessages = [
      ...activeConversation.messages,
      userMessage,
    ];

    updateConversation(conversationId, (c) => ({
      ...c,
      messages: nextMessages,
    }));

    try {
      const result = await sendMessage(
        nextMessages,
        settings.personality
      );

      let aiMessage: ChatMessage;

      if (result.imagePrompt) {
        const imageResult = await generateImage(
          result.imagePrompt
        );

        aiMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "",
          images: imageResult.images.map(
            (img): ChatImage => ({
              id: crypto.randomUUID(),
              url: img.url,
              prompt: img.prompt,
            })
          ),
        };
      } else {
        aiMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.reply,
        };
      }

      updateConversation(conversationId, (c) => ({
        ...c,
        title: result.title || c.title,
        messages: [...nextMessages, aiMessage],
      }));
    } catch (error) {
      updateConversation(conversationId, (c) => ({
        ...c,
        messages: [
          ...nextMessages,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              error instanceof Error
                ? `backend error: ${error.message}`
                : "bro the backend just exploded 💀",
          },
        ],
      }));
    } finally {
      setLoadingConversationId(null);
    }
  }

  async function handleFiles(files: File[]) {
    if (!activeConversation || files.length === 0) {
      return;
    }

    setLoadingConversationId(activeId);

    try {
      for (const file of files) {
        setUploadingFiles((prev) => [
          ...prev,
          file.name,
        ]);

        setUploadProgress((prev) => ({
          ...prev,
          [file.name]: 0,
        }));

        const result = await uploadFile(
          file,
          (progress) => {
            setUploadProgress((prev) => ({
              ...prev,
              [file.name]: progress,
            }));
          }
        );

        const fileData: ChatFile = {
          id: crypto.randomUUID(),
          name: result.name,
          type: result.type,
          text: result.text,
        };

        const userMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "user",
          content: "",
          files: [fileData],
        };

        const nextMessages = [
          ...activeConversation.messages,
          userMessage,
        ];

        updateConversation(activeId, (c) => ({
          ...c,
          messages: nextMessages,
        }));

        const response = await sendMessage(
          [
            ...nextMessages,
            {
              id: crypto.randomUUID(),
              role: "user",
              content:
                `file content from ${result.name}:\\n\\n` +
                result.text,
            },
          ],
          settings.personality
        );

        const aiMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.reply,
        };

        updateConversation(activeId, (c) => ({
          ...c,
          title: response.title || c.title,
          messages: [...nextMessages, aiMessage],
        }));

        setUploadingFiles((prev) =>
          prev.filter((name) => name !== file.name)
        );

        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[file.name];
          return next;
        });
      }
    } finally {
      setLoadingConversationId(null);
    }
  }

  async function regenerateLastAssistant() {
    if (!activeConversation || loadingConversationId) {
      return;
    }

    const messages = activeConversation.messages;

    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");

    if (!lastAssistant) {
      return;
    }

    const withoutAssistant = messages.filter(
      (m) => m.id !== lastAssistant.id
    );

    setLoadingConversationId(activeId);

    updateConversation(activeId, (c) => ({
      ...c,
      messages: withoutAssistant,
    }));

    try {
      const result = await sendMessage(
        withoutAssistant,
        settings.personality
      );

      let aiMessage: ChatMessage;

      if (result.imagePrompt) {
        const imageResult = await generateImage(
          result.imagePrompt
        );

        aiMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "",
          images: imageResult.images.map(
            (img): ChatImage => ({
              id: crypto.randomUUID(),
              url: img.url,
              prompt: img.prompt,
            })
          ),
        };
      } else {
        aiMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.reply,
        };
      }

      updateConversation(activeId, (c) => ({
        ...c,
        title: result.title || c.title,
        messages: [...withoutAssistant, aiMessage],
      }));
    } finally {
      setLoadingConversationId(null);
    }
  }

  function newChat() {
    const convo = createConversation();

    setConversations((prev) => [convo, ...prev]);
    setActiveId(convo.id);
    setInput("");
  }

  function togglePin(id: string) {
    updateConversation(id, (c) => ({
      ...c,
      pinned: !c.pinned,
    }));
  }

  function renameConversation(
    id: string,
    title: string
  ) {
    const next = title.trim();

    if (!next) {
      return;
    }

    updateConversation(id, (c) => ({
      ...c,
      title: next,
    }));
  }

  function deleteConversation(id: string) {
    setConversations((prev) => {
      const remaining = prev.filter(
        (c) => c.id !== id
      );

      if (!remaining.length) {
        const fresh = createConversation();
        setActiveId(fresh.id);
        return [fresh];
      }

      if (activeId === id) {
        setActiveId(remaining[0].id);
      }

      return remaining;
    });
  }

  function togglePinMessage(messageId: string) {
    updateConversation(activeId, (c) => ({
      ...c,
      messages: c.messages.map((m) =>
        m.id === messageId
          ? { ...m, pinned: !m.pinned }
          : m
      ),
    }));
  }

  function deleteMessage(messageId: string) {
    updateConversation(activeId, (c) => ({
      ...c,
      messages: c.messages.filter(
        (m) => m.id !== messageId
      ),
    }));
  }

  return {
    conversations: visibleConversations,
    activeConversation,
    activeId,
    setActiveId,
    newChat,
    input,
    setInput,
    send,
    handleFiles,
    uploadingFiles,
    uploadProgress,
    loading:
      loadingConversationId === activeId,
    search,
    setSearch,
    togglePin,
    renameConversation,
    deleteConversation,
    togglePinMessage,
    deleteMessage,
    regenerateLastAssistant,
    personality: settings.personality,
    setPersonality: (personality: string) =>
      setSettings({ personality }),
  };
}