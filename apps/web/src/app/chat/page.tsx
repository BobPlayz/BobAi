"use client";

import NeuralShell from "@/components/neural/NeuralShell";
import NeuralSidebar from "@/components/neural/NeuralSidebar";
import NeuralTopbar from "@/components/neural/NeuralTopbar";
import NeuralComposer from "@/components/neural/NeuralComposer";
import ChatWindow from "@/components/ChatWindow";
import ChatInput from "@/components/ChatInput";
import { useChat } from "@/hooks/useChat";
import { useTheme } from "@/components/neural/ThemeProvider";

export default function ChatPage() {
  const chat = useChat();
  const { theme } = useTheme();

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

  const activeConversation = chat.activeConversation;
  const hasMessages = Boolean(activeConversation?.messages.length);

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
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-[900px] flex-col px-4 py-6 sm:px-8 sm:py-8">
          {!activeConversation || !hasMessages ? (
            <div className="flex flex-1 items-center justify-center pb-8">
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/5 shadow-[0_0_36px_rgba(0,217,255,0.1)]">
                  <span className="text-xl font-black text-cyan-300">B</span>
                </div>
                <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white">Bob AI</h1>
                <p className="mt-2 text-sm text-cyan-100/45">start a conversation</p>
              </div>
            </div>
          ) : (
            <ChatWindow
              messages={activeConversation.messages}
              loading={chat.loading}
              onPinMessage={(id) => chat.togglePinMessage(chat.activeId, id)}
              onDeleteMessage={(id) => chat.deleteMessage(chat.activeId, id)}
              onRegenerate={chat.regenerateLastAssistant}
            />
          )}
        </div>
      </div>
    </NeuralShell>
  );
}
