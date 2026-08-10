"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import NeuralShell from "@/components/neural/NeuralShell";
import NeuralSidebar from "@/components/neural/NeuralSidebar";
import NeuralTopbar from "@/components/neural/NeuralTopbar";
import NeuralComposer from "@/components/neural/NeuralComposer";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Conversation = {
  id: string;
  title: string;
  pinned?: boolean;
  messages: Message[];
};

export default function ChatPage() {
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");

  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: "1",
      title: "New conversation",
      pinned: true,
      messages: [
        {
          id: "m1",
          role: "assistant",
          content: "I'm Bob AI. What are we building today?",
        },
      ],
    },
  ]);

  const [activeId, setActiveId] = useState("1");

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId),
    [conversations, activeId]
  );

  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages.length]);

  function handleNewChat() {
    const id = Date.now().toString();
    const conversation: Conversation = {
      id,
      title: "New conversation",
      messages: [
        {
          id: `${id}-a`,
          role: "assistant",
          content: "I'm Bob AI. What are we building today?",
        },
      ],
    };

    setConversations((prev) => [conversation, ...prev]);
    setActiveId(id);
  }

  function handleSend() {
    const text = input.trim();
    if (!text || !activeConversation) return;

    const userMessage: Message = {
      id: `${Date.now()}-u`,
      role: "user",
      content: text,
    };

    const assistantMessage: Message = {
      id: `${Date.now()}-a`,
      role: "assistant",
      content:
        "I'm Bob AI. This is a temporary response while we finish the interface and the intro sequence.",
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? {
              ...c,
              title:
                c.title === "New conversation"
                  ? text.slice(0, 32)
                  : c.title,
              messages: [...c.messages, userMessage, assistantMessage],
            }
          : c
      )
    );

    setInput("");
  }

  useEffect(() => {
    function onNewChat() {
      handleNewChat();
    }

    function onSearch(event: Event) {
      const custom = event as CustomEvent<string>;
      setSearch(custom.detail ?? "");
    }

    function onNotifications() {
      alert("Notifications panel coming next phase.");
    }

    function onSettings() {
      alert("Settings panel coming next phase.");
    }

    window.addEventListener("bobai:new-chat", onNewChat);
    window.addEventListener("bobai:search", onSearch as EventListener);
    window.addEventListener(
      "bobai:open-notifications",
      onNotifications as EventListener
    );
    window.addEventListener(
      "bobai:open-settings",
      onSettings as EventListener
    );

    return () => {
      window.removeEventListener("bobai:new-chat", onNewChat);
      window.removeEventListener(
        "bobai:search",
        onSearch as EventListener
      );
      window.removeEventListener(
        "bobai:open-notifications",
        onNotifications as EventListener
      );
      window.removeEventListener(
        "bobai:open-settings",
        onSettings as EventListener
      );
    };
  }, []);

  return (
    <NeuralShell
      sidebar={
        <NeuralSidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={setActiveId}
          onNewChat={handleNewChat}
          search={search}
          setSearch={setSearch}
          onPin={(id) =>
            setConversations((prev) =>
              prev.map((c) =>
                c.id === id ? { ...c, pinned: !c.pinned } : c
              )
            )
          }
          onRename={(id, title) =>
            setConversations((prev) =>
              prev.map((c) =>
                c.id === id ? { ...c, title } : c
              )
            )
          }
          onDelete={(id) =>
            setConversations((prev) =>
              prev.filter((c) => c.id !== id)
            )
          }
        />
      }
      topbar={<NeuralTopbar />}
      composer={
        <NeuralComposer
          input={input}
          setInput={setInput}
          onSend={handleSend}
          onFiles={() => {}}
        />
      }
    >
      <div className="flex h-full justify-center overflow-y-auto px-6 py-8">
        <div className="w-full max-w-[760px]">
          <div className="mb-8 text-center">
            <h1 className="text-[34px] font-semibold tracking-tight text-white">
              Bob AI
            </h1>
            <p className="mt-2 text-sm text-cyan-300/48">
              Start a conversation
            </p>
          </div>

          <div className="space-y-5 pb-10">
            {activeConversation?.messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "flex justify-end"
                    : "flex justify-start"
                }
              >
                <div
                  className={
                    message.role === "user"
                      ? "max-w-[70%] rounded-[24px] border border-cyan-300/18 bg-[#0A1622] px-5 py-4 text-[15px] leading-7 text-white shadow-[0_0_18px_rgba(0,217,255,0.08)]"
                      : "max-w-[70%] rounded-[24px] border border-cyan-400/10 bg-[#071018]/86 px-5 py-4 text-[15px] leading-7 text-cyan-50/92 shadow-[0_0_18px_rgba(0,217,255,0.06)]"
                  }
                >
                  {message.content}
                </div>
              </div>
            ))}

            <div ref={endRef} />
          </div>
        </div>
      </div>
    </NeuralShell>
  );
}