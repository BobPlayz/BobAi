"use client";

import { useEffect, useRef, useState } from "react";
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
  const [preview, setPreview] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<
    Record<string, boolean>
  >({});

  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loading]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPreview(null);
        setMenuId(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () =>
      window.removeEventListener("keydown", onKeyDown);
  }, []);

  const pinnedMessages = messages.filter((m) => m.pinned);

  const lastAssistantId = [...messages]
    .reverse()
    .find((m) => m.role === "assistant")?.id;

  return (
    <>
      <div className="flex-1 overflow-y-auto bg-[#0B0F14]">
        <div className="mx-auto max-w-3xl px-6 py-6">
          {pinnedMessages.length > 0 && (
            <div className="mb-6 rounded-xl border border-[#232B36] bg-[#10161D] p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
                Pinned
              </div>

              <div className="space-y-1">
                {pinnedMessages.map((message) => (
                  <a
                    key={message.id}
                    href={`#msg-${message.id}`}
                    className="block rounded-lg px-2 py-2 text-sm text-[#E5EEF7] transition hover:bg-[#141A22]"
                  >
                    {message.content.slice(0, 80)}
                  </a>
                ))}
              </div>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="flex min-h-[55vh] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#171D26]">
                  <span className="text-lg font-black text-[#38BDF8]">
                    B
                  </span>
                </div>

                <h2 className="mt-4 text-2xl font-semibold text-[#E5EEF7]">
                  Hey Bob
                </h2>

                <p className="mt-1 text-sm text-[#94A3B8]">
                  Ask anything
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((message) => (
                <div
                  id={`msg-${message.id}`}
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "chat-enter flex justify-end"
                      : "chat-enter flex justify-start"
                  }
                >
                  <div className="group relative max-w-[72%]">
                    {message.role === "user" ? (
                      <div className="relative rounded-xl border border-[#232B36] bg-[#171D26] px-4 py-2.5 text-[15px] leading-6 text-[#E5EEF7]">
                        <div className="pr-8 whitespace-pre-wrap">
                          {message.content}
                        </div>

                        <button
                          onClick={() =>
                            setMenuId(
                              menuId === message.id ? null : message.id
                            )
                          }
                          className="absolute right-2 top-2 rounded-md p-1 text-[#94A3B8] opacity-0 transition hover:bg-[#141A22] hover:text-[#E5EEF7] group-hover:opacity-100"
                        >
                          ⋯
                        </button>
                      </div>
                    ) : (
                      <div className="relative space-y-3 rounded-xl border border-[#232B36] bg-[#10161D] px-4 py-3">
                        {message.content && (
                          <div className="pr-8 text-[15px] leading-6 whitespace-pre-wrap text-[#E5EEF7]">
                            {message.content}
                          </div>
                        )}

                        {message.images && message.images.length > 0 && (
                          <div className="grid grid-cols-2 gap-3">
                            {message.images.map((image) => (
                              <div
                                key={image.id}
                                className="overflow-hidden rounded-xl border border-[#232B36] bg-[#141A22]"
                              >
                                <button
                                  type="button"
                                  onClick={() => setPreview(image.url)}
                                  className="relative block w-full"
                                >
                                  {!loadedImages[image.id] && (
                                    <div className="absolute inset-0 animate-pulse bg-[#171D26]" />
                                  )}

                                  <img
                                    src={image.url}
                                    alt={image.prompt}
                                    className="h-48 w-full object-cover transition duration-300 hover:scale-[1.01]"
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                    onLoad={() =>
                                      setLoadedImages((prev) => ({
                                        ...prev,
                                        [image.id]: true,
                                      }))
                                    }
                                    onError={(e) => {
                                      const target =
                                        e.currentTarget as HTMLImageElement;

                                      target.src = `https://image.pollinations.ai/prompt/${encodeURIComponent(
                                        image.prompt
                                      )}?seed=${
                                        Date.now() +
                                        Math.floor(Math.random() * 10000)
                                      }&model=flux&width=1024&height=1024&nologo=true`;
                                    }}
                                  />
                                </button>

                                <div className="flex items-center justify-between border-t border-[#232B36] px-3 py-2 text-xs text-[#94A3B8]">
                                  <button
                                    onClick={() =>
                                      navigator.clipboard.writeText(
                                        image.prompt
                                      )
                                    }
                                    className="rounded-md px-2 py-1 transition hover:bg-[#171D26] hover:text-[#E5EEF7]"
                                  >
                                    Copy prompt
                                  </button>

                                  <a
                                    href={image.url}
                                    download
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-md px-2 py-1 transition hover:bg-[#171D26] hover:text-[#E5EEF7]"
                                  >
                                    Download
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          onClick={() =>
                            setMenuId(
                              menuId === message.id ? null : message.id
                            )
                          }
                          className="absolute right-2 top-2 rounded-md p-1 text-[#94A3B8] opacity-0 transition hover:bg-[#141A22] hover:text-[#E5EEF7] group-hover:opacity-100"
                        >
                          ⋯
                        </button>
                      </div>
                    )}

                    {message.pinned && (
                      <div className="mt-1 text-xs text-[#38BDF8]">
                        Pinned
                      </div>
                    )}
                    
                    {message.role === "assistant" &&
                      message.id === lastAssistantId && (
                        <button
                          onClick={onRegenerate}
                          disabled={loading}
                          className="mt-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#232B36] bg-[#141A22] text-[#94A3B8] transition hover:border-[#38BDF8] hover:text-[#38BDF8] disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Regenerate response"
                        >
                          ↻
                        </button>
                      )}

                    {menuId === message.id && (
                      <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-[#232B36] bg-[#10161D] py-1 shadow-2xl">
                        <button
                          onClick={() => {
                            onPinMessage(message.id);
                            setMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-[#E5EEF7] transition hover:bg-[#141A22]"
                        >
                          {message.pinned ? "Unpin" : "Pin"}
                        </button>

                        <button
                          onClick={async () => {
                            await navigator.clipboard.writeText(
                              message.content
                            );
                            setMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-[#E5EEF7] transition hover:bg-[#141A22]"
                        >
                          Copy
                        </button>

                        <button
                          onClick={() => {
                            onDeleteMessage(message.id);
                            setMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-red-400 transition hover:bg-[#141A22]"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div className="mt-4 flex justify-start">
              <div className="flex items-center gap-2 rounded-full border border-[#232B36] bg-[#10161D] px-3 py-2 text-sm text-[#94A3B8]">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#2A3340] border-t-[#38BDF8]" />
                Bob AI is thinking...
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
          onClick={() => setPreview(null)}
        >
          <img
            src={preview}
            alt="Preview"
            className="max-h-full max-w-full rounded-xl border border-[#232B36]"
          />
        </div>
      )}
    </>
  );
}