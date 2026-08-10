"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import NeuralShell from "@/components/neural/NeuralShell";
import NeuralSidebar from "@/components/neural/NeuralSidebar";
import NeuralTopbar from "@/components/neural/NeuralTopbar";
import NeuralChatStage from "@/components/neural/NeuralChatStage";
import NeuralComposer from "@/components/neural/NeuralComposer";

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
      <div className="flex h-screen items-center justify-center bg-[#02050A]">
        <div className="text-sm tracking-[0.22em] text-cyan-300/70 uppercase">
          Initializing Neural Interface
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <NeuralShell
        sidebar={
          <NeuralSidebar
            conversations={chat.conversations}
            activeId={chat.activeConversation.id}
            onSelect={chat.selectConversation}
            onNewChat={chat.createConversation}
            search={chat.search}
            setSearch={chat.setSearch}
            onPin={chat.togglePinConversation}
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
            onFiles={chat.handleFiles}
            disabled={chat.loading}
          />
        }
      >
        <NeuralChatStage
          messages={chat.activeConversation.messages}
          loading={chat.loading}
          onPinMessage={chat.togglePinMessage}
          onDeleteMessage={chat.deleteMessage}
          onRegenerate={chat.regenerateLastAssistant}
        />
      </NeuralShell>
    </div>
  );
}