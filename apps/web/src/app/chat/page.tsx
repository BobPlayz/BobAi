"use client";

import NeuralShell from "@/components/neural/NeuralShell";
import NeuralSidebar from "@/components/neural/NeuralSidebar";
import NeuralTopbar from "@/components/neural/NeuralTopbar";
import NeuralComposer from "@/components/neural/NeuralComposer";
import ChatWindow from "@/components/ChatWindow";
import TalkMode from "@/components/TalkMode";
import { loadPreferences } from "@/lib/preferences";
import { useEffect, useState } from "react";
import { useChat } from "@/hooks/useChat";

const VOICE_REPLIES_KEY = "jarvis.voiceReplies";

export default function ChatPage() {
  const chat = useChat();
  const [voiceReplies, setVoiceReplies] = useState(false);
  const [talking, setTalking] = useState(false);
  useEffect(() => { try { setVoiceReplies(localStorage.getItem(VOICE_REPLIES_KEY) === "on"); } catch { /* storage unavailable */ } }, []);
  function toggleVoiceReplies() {
    setVoiceReplies((current) => { const next = !current; try { localStorage.setItem(VOICE_REPLIES_KEY, next ? "on" : "off"); } catch { /* storage unavailable */ } return next; });
  }

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
          voiceReplies={voiceReplies}
          onToggleVoiceReplies={toggleVoiceReplies}
          onTalk={() => setTalking(true)}
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
        voiceReplies={voiceReplies && !talking}
        autoPlayMessageId={chat.lastReplyId}
      />
      {talking && <TalkMode language={loadPreferences().language} onUtterance={chat.send} onClose={() => setTalking(false)} />}
    </NeuralShell>
  );
}
