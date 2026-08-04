"use client";

import { useEffect, useMemo, useState } from "react";
import { sendMessage } from "@/lib/api";
import type { Conversation, ChatMessage } from "@/types/chat";

const STORAGE_KEY = "bobai.conversations.v1";

function createConversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    title: "new chat",
    createdAt: Date.now(),
    pinned: false,
    messages: [],
  };
}

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [loadingConversationId, setLoadingConversationId] =
    useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw) {
      try {
        const saved = JSON.parse(raw) as Conversation[];
        if (saved.length > 0) {
          setConversations(saved);
          setActiveId(saved[0].id);
          return;
        }
      } catch {}
    }

    const first = createConversation();
    setConversations([first]);
    setActiveId(first.id);
  }, []);

  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(conversations)
      );
    }
  }, [conversations]);

  const activeConversation =
    conversations.find((c) => c.id === activeId);

  const visibleConversations = useMemo(() => {
    const filtered = conversations.filter((c) =>
      c.title.toLowerCase().includes(search.toLowerCase())
    );

    const pinned = filtered
      .filter((c) => c.pinned)
      .sort((a, b) => b.createdAt - a.createdAt);

    const regular = filtered
      .filter((c) => !c.pinned)
      .sort((a, b) => b.createdAt - a.createdAt);

    return [...pinned, ...regular];
  }, [conversations, search]);

  async function send() {
    const text = input.trim();
    if (!text || !activeConversation || loadingConversationId)
      return;

    const conversationId = activeId;
    setInput("");
    setLoadingConversationId(conversationId);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              title:
                c.messages.length === 0
                  ? text.slice(0, 32)
                  : c.title,
              messages: [...c.messages, userMessage],
            }
          : c
      )
    );

    try {
      const result = await sendMessage(text);

      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.reply,
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: [...c.messages, aiMessage],
              }
            : c
        )
      );
    } catch {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "bro the backend just exploded 💀",
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: [...c.messages, errorMessage],
              }
            : c
        )
      );
    } finally {
      setLoadingConversationId((current) =>
        current === conversationId ? null : current
      );
    }
  }

  function newChat() {
    const convo = createConversation();
    setConversations((prev) => [convo, ...prev]);
    setActiveId(convo.id);
    setInput("");
  }

  function togglePin(id: string) {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, pinned: !c.pinned } : c
      )
    );
  }

  function renameConversation(id: string, title: string) {
    const next = title.trim();
    if (!next) return;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, title: next } : c
      )
    );
  }

  function deleteConversation(id: string) {
    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== id);

      if (remaining.length === 0) {
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
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId
                  ? { ...m, pinned: !m.pinned }
                  : m
              ),
            }
          : c
      )
    );
  }

  function deleteMessage(messageId: string) {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              messages: c.messages.filter(
                (m) => m.id !== messageId
              ),
            }
          : c
      )
    );
  }

  async function regenerateLastAssistant() {
    if (!activeConversation || loadingConversationId) return;

    const messages = activeConversation.messages;
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");

    if (!lastAssistant) return;

    const lastUser = messages
      .slice(0, messages.indexOf(lastAssistant))
      .reverse()
      .find((m) => m.role === "user");

    if (!lastUser) return;

    const conversationId = activeId;
    setLoadingConversationId(conversationId);

    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: c.messages.filter(
                (m) => m.id !== lastAssistant.id
              ),
            }
          : c
      )
    );

    try {
      const result = await sendMessage(lastUser.content);

      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.reply,
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: [...c.messages, aiMessage],
              }
            : c
        )
      );
    } finally {
      setLoadingConversationId(null);
    }
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
    loading: loadingConversationId === activeId,
    search,
    setSearch,
    togglePin,
    renameConversation,
    deleteConversation,
    togglePinMessage,
    deleteMessage,
    regenerateLastAssistant,
  };
}