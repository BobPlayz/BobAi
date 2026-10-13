"use client";

import NeuralShell from "@/components/neural/NeuralShell";
import NeuralSidebar from "@/components/neural/NeuralSidebar";
import NeuralTopbar from "@/components/neural/NeuralTopbar";
import NeuralComposer from "@/components/neural/NeuralComposer";
import ChatWindow from "@/components/ChatWindow";
import { useChat } from "@/hooks/useChat";

export default function ChatPage() {
  const chat = useChat();

  return (
    <NeuralShell
      sidebar={
        <NeuralSidebar
          conversations={chat.conversations}
          activeId={chat.activeId}
          onSelect={chat.setActiveId}
          onNewChat={chat.newChat}
          search={chat.search}
          setSearch={chat.setSearch}
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
          disabled={chat.loading}
          streaming={chat.streaming}
          onStop={chat.stop}
        />
      }
    >
      <ChatWindow
        messages={chat.activeConversation?.messages ?? []}
        loading={chat.loading}
        onPinMessage={(id) => chat.togglePinMessage(chat.activeId, id)}
        onDeleteMessage={(id) => chat.deleteMessage(chat.activeId, id)}
        onRegenerate={chat.regenerateLastAssistant}
      />
    </NeuralShell>
  );
}
