"use client";

import { useEffect, useRef } from "react";
import NeuralShell from "@/components/neural/NeuralShell";
import NeuralSidebar from "@/components/neural/NeuralSidebar";
import NeuralTopbar from "@/components/neural/NeuralTopbar";
import NeuralComposer from "@/components/neural/NeuralComposer";
import { useChat } from "@/hooks/useChat";
import BorderGlow from "@/components/BorderGlow";
import ChatWindow from "@/components/ChatWindow";
import ChatInput from "@/components/ChatInput";
import { useTheme } from "@/components/neural/ThemeProvider";

export default function ChatPage() {
  const chat = useChat();
  const { theme } = useTheme();
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.activeConversation?.messages.length, chat.loading]);

  function handleSearch(value: string) {
    chat.setSearch(value);
  }

  if (theme === "legacy") {
    return (
      <main className="flex h-screen flex-col bg-background text-text">
        <ChatWindow
          messages={chat.activeConversation?.messages || []}
          loading={chat.loading}
          onPinMessage={(id) => chat.togglePinMessage(chat.activeId, id)}
          onDeleteMessage={(id) => chat.deleteMessage(chat.activeId, id)}
          onRegenerate={chat.regenerateLastAssistant}
        />
        <ChatInput
          input={chat.input}
          setInput={chat.setInput}
          onSend={chat.send}
          onFiles={(files) => {
            if (files) void chat.handleFiles(Array.from(files));
          }}
          disabled={chat.loading}
          uploadingFiles={chat.uploadingFiles}
          uploadProgress={chat.uploadProgress}
        />
      </main>
    );
  }

  return (
    <NeuralShell
      sidebar={
        <NeuralSidebar
          conversations={chat.conversations}
          activeId={chat.activeId}
          onSelect={chat.setActiveId}
          onNewChat={chat.newChat}
          search={chat.search}
          setSearch={handleSearch}
          onPin={chat.togglePin}
          onRename={chat.renameConversation}
          onDelete={chat.deleteConversation}
        />
      }
      topbar={<NeuralTopbar />}
      composer={
        <NeuralComposer
          input={chat.input}
          setInput={chat.setInput}
          onSend={chat.send}
          onFiles={(files) => {
            if (files) void chat.handleFiles(Array.from(files));
          }}
        />
      }
    >
      <div className="flex h-full justify-center overflow-y-auto px-6 py-8">
        <BorderGlow className="w-full max-w-[760px] rounded-[28px]">
          {chat.activeConversation?.messages.length === 0 ? (
            <div className="flex min-h-full items-center justify-center">
              <div className="pb-24 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/5 shadow-[0_0_40px_rgba(0,217,255,0.12)]">
                  <span className="text-2xl font-black text-cyan-300">B</span>
                </div>
                <h1 className="mt-6 text-[34px] font-semibold tracking-tight text-white">Bob AI</h1>
                <p className="mt-2 text-sm text-cyan-100/45">start a conversation</p>
              </div>
            </div>
          ) : (
            <ChatWindow
              messages={chat.activeConversation?.messages || []}
              loading={chat.loading}
              onPinMessage={(id) => chat.togglePinMessage(chat.activeId, id)}
              onDeleteMessage={(id) => chat.deleteMessage(chat.activeId, id)}
              onRegenerate={chat.regenerateLastAssistant}
            />
          )}
          <div ref={endRef} />
        </BorderGlow>
      </div>
    </NeuralShell>
  );
}