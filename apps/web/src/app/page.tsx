"use client";

import ChatWindow from "@/components/ChatWindow";
import ChatInput from "@/components/ChatInput";
import { useChat } from "@/hooks/useChat";

export default function HomePage() {
  const chat = useChat();

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
        onFiles={chat.handleFiles}
        disabled={chat.loading}
        uploadingFiles={chat.uploadingFiles}
        uploadProgress={chat.uploadProgress}
      />
    </main>
  );
}