"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import ChatWindow from "@/components/ChatWindow";
import ChatInput from "@/components/ChatInput";
import { useChat } from "@/hooks/useChat";
import { isLoggedIn } from "@/lib/auth";

export default function ChatPage() {
  const router = useRouter();
  const chat = useChat();

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
    }
  }, [router]);

  if (!chat.activeConversation) {
    return (
      <main className="flex h-screen items-center justify-center bg-black text-white">
        <div className="text-white/50">loading bobai...</div>
      </main>
    );
  }

  return (
    <main className="h-screen bg-black text-white">
      <div className="flex h-full">
        <Sidebar
          conversations={chat.conversations}
          activeId={chat.activeId}
          onSelect={chat.setActiveId}
          onNewChat={chat.newChat}
          search={chat.search}
          setSearch={chat.setSearch}
          onTogglePin={chat.togglePin}
          onRename={chat.renameConversation}
          onDelete={chat.deleteConversation}
        />

        <section className="flex flex-1 flex-col bg-black">
          <Topbar />

          <ChatWindow
            messages={chat.activeConversation.messages}
            loading={chat.loading}
            onPinMessage={chat.togglePinMessage}
            onDeleteMessage={chat.deleteMessage}
            onRegenerate={chat.regenerateLastAssistant}
          />

          <ChatInput
            value={chat.input}
            onChange={chat.setInput}
            onSend={chat.send}
          />
        </section>
      </div>
    </main>
  );
}