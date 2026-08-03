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

  return (
    <main className="h-screen bg-[#0a0a0a] text-white">
      <div className="flex h-full">
        <Sidebar />

        <section className="flex flex-1 flex-col bg-[#0a0a0a]">
          <Topbar />

          <ChatWindow messages={chat.messages} loading={chat.loading} />

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