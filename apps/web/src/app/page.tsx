"use client";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import ChatWindow from "@/components/ChatWindow";
import ChatInput from "@/components/ChatInput";
import { useChat } from "@/hooks/useChat";

export default function HomePage() {
  const chat = useChat();

  return (
    <main className="h-screen bg-[#0a0a0a] text-white">
      <div className="flex h-full">
        <Sidebar />

        <section className="flex flex-1 flex-col">
          <Topbar />

          <ChatWindow messages={chat.messages} />

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