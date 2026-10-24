"use client";

import NeuralShell from "@/components/neural/NeuralShell";
import NeuralSidebar from "@/components/neural/NeuralSidebar";
import NeuralTopbar from "@/components/neural/NeuralTopbar";
import NeuralComposer from "@/components/neural/NeuralComposer";
import ChatWindow from "@/components/ChatWindow";
import TalkMode from "@/components/TalkMode";
import Shortcuts from "@/components/Shortcuts";
import { loadPreferences } from "@/lib/preferences";
import { reportReply } from "@/lib/api";
import { useState } from "react";
import { useChat } from "@/hooks/useChat";


export default function ChatPage() {
  const chat = useChat();
  const [talking, setTalking] = useState(false);

  return (
    <NeuralShell
      sidebar={
        <NeuralSidebar
          conversations={chat.conversations.filter((conversation) => conversation.messages.length > 0)}
          activeId={chat.activeId}
          onSelect={chat.setActiveId}
          onNewChat={chat.newChat}
          search={chat.search}
          setSearch={chat.setSearch}
          onPin={chat.togglePin}
          onRename={chat.renameConversation}
          onDelete={chat.deleteConversation}
          onShare={chat.shareChat}
          onUnshare={chat.unshareChat}
        />
      }
      topbar={<NeuralTopbar caption={chat.activeConversation?.messages.length ? chat.activeConversation.title : "New chat"} />}
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
          uploadingFiles={chat.uploadingFiles}
          uploadProgress={chat.uploadProgress}
          onCancelUpload={chat.cancelUpload}
          onTalk={() => setTalking(true)}
          onVoiceSend={(text) => { void chat.send(text); }}
        />
      }
    >
      <ChatWindow
        messages={chat.activeConversation?.messages ?? []}
        loading={chat.loading}
        loadingLabel={chat.generatingImage ? "creating your image" : "working on it"}
        onPinMessage={(id) => chat.togglePinMessage(chat.activeId, id)}
        onDeleteMessage={(id) => chat.deleteMessage(chat.activeId, id)}
        onRegenerate={chat.regenerateLastAssistant}
        onResolveApproval={chat.resolveApproval}
        onSuggestion={chat.setInput}
        autoPlayMessageId={chat.lastReplyId}
        onReport={reportReply}
        onEditLast={(id) => chat.editLastUserMessage(chat.activeId, id)}
      />
      <Shortcuts onNewChat={chat.newChat} onStop={chat.stop} streaming={chat.streaming} />
      {talking && <TalkMode language={loadPreferences().language} onUtterance={(text) => chat.send(text, { voice: true })} onCancel={chat.stop} onClose={() => setTalking(false)} />}
    </NeuralShell>
  );
}
