"use client";

import type { Message } from "@/types/chat";
import {
  Bot,
  User,
  Pin,
  RotateCcw,
  Trash2,
  Sparkles,
} from "lucide-react";

type Props = {
  messages: Message[];
  loading: boolean;
  onPinMessage: (id: string) => void;
  onDeleteMessage: (id: string) => void;
  onRegenerate: () => void;
};

export default function NeuralChatStage({
  messages,
  loading,
  onPinMessage,
  onDeleteMessage,
  onRegenerate,
}: Props) {
  return (
    <div className="relative h-full overflow-y-auto bg-[#05080D]">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-400/6 blur-[120px]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[960px] flex-col gap-6 px-8 py-8">
        {messages.map((message) => {
          const isAssistant = message.role === "assistant";

          return (
            <div
              key={message.id}
              className={isAssistant ? "flex justify-start" : "flex justify-end"}
            >
              <div
                className={
                  isAssistant
                    ? "group flex max-w-[760px] gap-4"
                    : "group flex max-w-[760px] flex-row-reverse gap-4"
                }
              >
                {/* Avatar */}
                <div
                  className={
                    isAssistant
                      ? "flex h-11 w-11 items-center justify-center rounded-full border border-cyan-300/20 bg-[#0A1622] shadow-[0_0_18px_rgba(0,217,255,0.18)]"
                      : "flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#111A24]"
                  }
                >
                  {isAssistant ? (
                    <Bot className="h-5 w-5 text-cyan-300" />
                  ) : (
                    <User className="h-5 w-5 text-white/80" />
                  )}
                </div>

                {/* Message card */}
                <div
                  className={
                    isAssistant
                      ? "relative overflow-hidden rounded-[22px] border border-cyan-400/12 bg-[#081018] px-5 py-4 shadow-[0_0_24px_rgba(0,217,255,0.08)]"
                      : "relative overflow-hidden rounded-[22px] border border-white/8 bg-[#111A24] px-5 py-4"
                  }
                >
                  {isAssistant && (
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,217,255,0.08),transparent_55%)]" />
                  )}

                  <div className="relative flex items-center gap-2">
                    {isAssistant ? (
                      <>
                        <Sparkles className="h-4 w-4 text-cyan-300" />
                        <span className="text-sm font-semibold tracking-wide text-cyan-100">
                          Bob AI
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-semibold tracking-wide text-white">
                        You
                      </span>
                    )}
                  </div>

                  <div className="relative mt-3 whitespace-pre-wrap text-[15px] leading-7 text-white/90">
                    {message.content}
                  </div>

                  <div className="relative mt-4 flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/40">
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>

                    <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <button
                        onClick={() => onPinMessage(message.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/10 bg-[#0A1118] text-cyan-300/70 hover:border-cyan-300/25 hover:text-cyan-100"
                      >
                        <Pin className="h-4 w-4" />
                      </button>

                      {isAssistant && (
                        <button
                          onClick={onRegenerate}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/10 bg-[#0A1118] text-cyan-300/70 hover:border-cyan-300/25 hover:text-cyan-100"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      )}

                      <button
                        onClick={() => onDeleteMessage(message.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/10 bg-[#0A1118] text-cyan-300/70 hover:border-red-400/25 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start">
            <div className="flex max-w-[760px] gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-cyan-300/20 bg-[#0A1622] shadow-[0_0_18px_rgba(0,217,255,0.18)]">
                <Bot className="h-5 w-5 text-cyan-300" />
              </div>

              <div className="overflow-hidden rounded-[22px] border border-cyan-400/12 bg-[#081018] px-5 py-4 shadow-[0_0_24px_rgba(0,217,255,0.08)]">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-300" />
                  <span className="text-sm font-semibold tracking-wide text-cyan-100">
                    Bob AI
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" />
                  <div className="h-2 w-2 rounded-full bg-cyan-300/80 animate-pulse [animation-delay:120ms]" />
                  <div className="h-2 w-2 rounded-full bg-cyan-300/60 animate-pulse [animation-delay:240ms]" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}