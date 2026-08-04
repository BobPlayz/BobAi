"use client";

import { useState } from "react";
import type { ChatMessage } from "@/types/chat";

type Props = {
  messages: ChatMessage[];
  loading: boolean;
  onPinMessage: (id: string) => void;
  onDeleteMessage: (id: string) => void;
  onRegenerate: () => void;
};

export default function ChatWindow({
  messages,
  loading,
  onPinMessage,
  onDeleteMessage,
  onRegenerate,
}: Props) {
  const [menuId, setMenuId] = useState<string | null>(null);

  const pinnedMessages = messages.filter((m) => m.pinned);

  const lastAssistantId = [...messages]
    .reverse()
    .find((m) => m.role === "assistant")?.id;

  return (
    <div className="flex-1 overflow-y-auto bg-black px-6 py-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        {pinnedMessages.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-[#121212] p-3">
            <div className="mb-2 text-xs uppercase tracking-wide text-white/40">
              pinned messages
            </div>

            <div className="space-y-2">
              {pinnedMessages.map((message) => (
                <a
                  key={message.id}
                  href={`#msg-${message.id}`}
                  className="block rounded-xl px-2 py-2 text-sm text-white/80 transition hover:bg-white/5"
                >
                  {message.content.slice(0, 80)}
                </a>
              ))}
            </div>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-24">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black">
                <span className="text-xl font-black">B</span>
              </div>

              <h2 className="mt-6 text-3xl font-semibold text-white">
                hey bob
              </h2>

              <p className="mt-2 text-white/45">
                ask anything
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              id={`msg-${message.id}`}
              key={message.id}
              className={
                message.role === "user"
                  ? "flex justify-end"
                  : "flex justify-start"
              }
            >
              <div className="group relative max-w-[80%]">
                {message.role === "user" ? (
                  <div className="rounded-3xl border border-white/10 bg-[#1a1a1a] px-5 py-3 text-[15px] text-white">
                    {message.content}
                  </div>
                ) : (
                  <div className="px-1 py-1 text-[15px] leading-7 text-white">
                    {message.content}
                  </div>
                )}

                {message.pinned && (
                  <div className="mt-1 text-xs text-[#d4a62a]">
                    pinned
                  </div>
                )}

                {message.role === "assistant" &&
                  message.id === lastAssistantId && (
                    <button
                      onClick={onRegenerate}
                      disabled={loading}
                      className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-[#121212] px-3 py-2 text-sm text-white/80 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ↻ regenerate
                    </button>
                  )}

                <button
                  onClick={() =>
                    setMenuId(
                      menuId === message.id ? null : message.id
                    )
                  }
                  className="absolute -right-2 top-0 rounded-lg p-1 text-white/45 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
                >
                  ⋯
                </button>

                {menuId === message.id && (
                  <div className="absolute right-0 top-8 z-10 w-44 rounded-xl border border-white/10 bg-[#121212] py-1 shadow-2xl">
                    <button
                      onClick={() => {
                        onPinMessage(message.id);
                        setMenuId(null);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-white transition hover:bg-white/5"
                    >
                      {message.pinned ? "unpin" : "pin"}
                    </button>

                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(
                          message.content
                        );
                        setMenuId(null);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-white transition hover:bg-white/5"
                    >
                      copy
                    </button>

                    <button
                      onClick={() => {
                        onDeleteMessage(message.id);
                        setMenuId(null);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-red-400 transition hover:bg-white/5"
                    >
                      delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="text-white/45">
              bobai is thinking...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}