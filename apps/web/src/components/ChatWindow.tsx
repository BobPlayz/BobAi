"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/types/chat";

export default function ChatWindow({
  messages,
  loading,
}: {
  messages: ChatMessage[];
  loading: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loading]);

  return (
    <div className="flex-1 overflow-y-auto px-8 py-10">
      <div className="mx-auto max-w-3xl">
        {messages.length === 0 ? (
          <div className="pt-28 text-center text-white/35">
            <h1 className="text-5xl font-black tracking-tight text-white">
              yo.
            </h1>
            <p className="mt-4 text-lg text-white/45">
              this is bobai. what are we building today?
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {messages.map((message) => (
              <div
                key={message.id}
                className={message.role === "user" ? "text-right" : "text-left"}
              >
                <p
                  className={
                    message.role === "user"
                      ? "text-white text-[17px] leading-8 font-medium"
                      : "text-white/90 text-[17px] leading-8"
                  }
                >
                  {message.content}
                </p>
              </div>
            ))}

            {loading && (
              <div className="text-left">
                <p className="text-white/40 text-sm animate-pulse">
                  bobai is thinking...
                </p>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}