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
    endRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
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
          onPinMessage={chat.togglePinMessage}
          onDeleteMessage={chat.deleteMessage}
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
                  <span className="text-2xl font-black text-cyan-300">
                    B
                  </span>
                </div>

                <h1 className="mt-6 text-[34px] font-semibold tracking-tight text-white">
                  Bob AI
                </h1>

                <p className="mt-2 text-sm text-cyan-100/45">
                  start a conversation
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5 pb-10">
              {chat.activeConversation?.messages.map((message) => (
                <div
                  key={message.id}
                  id={`msg-${message.id}`}
                  className={
                    message.role === "user"
                      ? "flex justify-end"
                      : "flex justify-start"
                  }
                >
                  <div
                    className={
                      message.role === "user"
                        ? "max-w-[78%] rounded-[24px] border border-cyan-300/18 bg-[#0A1622]/90 px-5 py-4 text-[15px] leading-7 text-white shadow-[0_0_24px_rgba(0,217,255,0.08)] backdrop-blur-xl"
                        : "max-w-[78%] rounded-[24px] border border-cyan-400/10 bg-[#071018]/72 px-5 py-4 text-[15px] leading-7 text-cyan-50/92 shadow-[0_0_24px_rgba(0,217,255,0.06)] backdrop-blur-xl"
                    }
                  >
                    {message.content && (
                      <div className="whitespace-pre-wrap">
                        {message.content}
                      </div>
                    )}

                    {message.files?.map((file) => (
                      <div
                        key={file.id}
                        className="mt-2 rounded-xl border border-cyan-300/10 bg-black/20 px-3 py-2 text-xs text-cyan-100/70"
                      >
                        {file.name}
                      </div>
                    ))}

                    {message.images && message.images.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        {message.images.map((image) => (
                          <img
                            key={image.id}
                            src={image.url}
                            alt={image.prompt}
                            className="w-full rounded-xl border border-cyan-300/10"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {chat.loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-3 rounded-full border border-cyan-300/10 bg-[#071018]/70 px-4 py-2 text-sm text-cyan-100/55 backdrop-blur-xl">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-300/15 border-t-cyan-300" />
                    bob ai is thinking...
                  </div>
                </div>
              )}

              <div ref={endRef} />
            </div>
          )}
        </BorderGlow>
      </div>
    </NeuralShell>
  );
}