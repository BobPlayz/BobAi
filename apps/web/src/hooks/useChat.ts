"use client";

import { useEffect, useState } from "react";
import type { ChatMessage } from "@/types/chat";
import { loadConversation, sendMessage } from "@/lib/api";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConversation()
      .then((data) => {
        const loaded: ChatMessage[] = data.messages.map(
          (m: { role: "user" | "assistant"; content: string }, i: number) => ({
            id: String(i),
            role: m.role,
            content: m.content,
            createdAt: new Date().toISOString(),
          }),
        );

        setMessages(
          loaded.length
            ? loaded
            : [
                {
                  id: "1",
                  role: "assistant",
                  content: "yo. this is bobai. what are we building today?",
                  createdAt: new Date().toISOString(),
                },
              ],
        );
      })
      .catch(() => {});
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setLoading(true);

    try {
      const data = await sendMessage(text);

      const loaded: ChatMessage[] = data.messages.map(
        (m: { role: "user" | "assistant"; content: string }, i: number) => ({
          id: String(i),
          role: m.role,
          content: m.content,
          createdAt: new Date().toISOString(),
        }),
      );

      setMessages(loaded);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "bro the backend just exploded 💀",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return {
    messages,
    input,
    setInput,
    send,
    loading,
  };
}