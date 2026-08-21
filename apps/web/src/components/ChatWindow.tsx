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
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreview(null);
        setMenuId(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const pinnedMessages = messages.filter((message) => message.pinned);

  const lastAssistantId = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.id;

  return (
    <>
      <section className="relative min-h-0 flex-1 overflow-hidden">
        {/* ambient workspace glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute left-[12%] top-[8%] h-72 w-72 rounded-full bg-cyan-400/[0.025] blur-[120px]" />
          <div className="absolute bottom-[4%] right-[12%] h-96 w-96 rounded-full bg-sky-500/[0.02] blur-[140px]" />
        </div>

        <div className="relative h-full overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-4 pb-32 pt-8 sm:px-6 lg:px-8">
            {/* pinned messages */}
            {pinnedMessages.length > 0 && (
              <div className="neural-panel motion-panel mb-8 overflow-hidden rounded-2xl">
                <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06]">
                    <span className="text-xs text-cyan-300">⌖</span>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
                      Memory
                    </p>
                    <p className="text-xs text-white/35">
                      Pinned conversation context
                    </p>
                  </div>
                </div>

                <div className="space-y-1 p-2">
                  {pinnedMessages.map((message) => (
                    <a
                      key={message.id}
                      href={`#msg-${message.id}`}
                      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/65 hover:bg-white/[0.035] hover:text-white"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(77,235,255,0.8)]" />

                      <span className="min-w-0 truncate">
                        {message.content.slice(0, 100)}
                      </span>

                      <span className="ml-auto text-xs text-white/20 opacity-0 transition group-hover:opacity-100">
                        jump
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* empty state */}
            {messages.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-8">
                {messages.map((message) => {
                  const isUser = message.role === "user";
                  const isLastAssistant =
                    message.role === "assistant" &&
                    message.id === lastAssistantId;

                  return (
                    <article
                      id={`msg-${message.id}`}
                      key={message.id}
                      className={`chat-enter flex ${
                        isUser ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`group relative ${
                          isUser
                            ? "w-fit max-w-[86%] sm:max-w-[72%]"
                            : "w-full max-w-[820px]"
                        }`}
                      >
                        {isUser ? (
                          <UserMessage
                            message={message}
                            menuOpen={menuId === message.id}
                            onMenu={() =>
                              setMenuId(
                                menuId === message.id ? null : message.id
                              )
                            }
                            onPin={() => {
                              onPinMessage(message.id);
                              setMenuId(null);
                            }}
                            onCopy={async () => {
                              await navigator.clipboard.writeText(
                                message.content
                              );
                              setMenuId(null);
                            }}
                            onDelete={() => {
                              onDeleteMessage(message.id);
                              setMenuId(null);
                            }}
                          />
                        ) : (
                          <AssistantMessage
                            message={message}
                            menuOpen={menuId === message.id}
                            loadedImages={loadedImages}
                            onImageLoaded={(imageId) =>
                              setLoadedImages((previous) => ({
                                ...previous,
                                [imageId]: true,
                              }))
                            }
                            onPreview={setPreview}
                            onMenu={() =>
                              setMenuId(
                                menuId === message.id ? null : message.id
                              )
                            }
                            onPin={() => {
                              onPinMessage(message.id);
                              setMenuId(null);
                            }}
                            onCopy={async () => {
                              await navigator.clipboard.writeText(
                                message.content
                              );
                              setMenuId(null);
                            }}
                            onDelete={() => {
                              onDeleteMessage(message.id);
                              setMenuId(null);
                            }}
                          />
                        )}

                        {message.pinned && (
                          <div
                            className={`mt-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-cyan-300/70 ${
                              isUser ? "justify-end" : "justify-start"
                            }`}
                          >
                            <span className="h-1 w-1 rounded-full bg-cyan-300" />
                            pinned
                          </div>
                        )}

                        {isLastAssistant && (
                          <button
                            type="button"
                            onClick={onRegenerate}
                            disabled={loading}
                            className="mt-3 inline-flex h-8 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 text-xs text-white/40 hover:border-cyan-300/20 hover:bg-cyan-300/[0.04] hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label="Regenerate response"
                          >
                            <span className="text-sm">↻</span>
                            regenerate
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* thinking state */}
            {loading && (
              <div className="mt-8 flex justify-start">
                <div className="neural-panel flex items-center gap-3 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
                    <span
                      className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300"
                      style={{ animationDelay: "120ms" }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300"
                      style={{ animationDelay: "240ms" }}
                    />
                  </div>

                  <span className="text-xs font-medium tracking-wide text-white/45">
                    bob is thinking
                  </span>
                </div>
              </div>
            )}

            <div ref={endRef} className="h-4" />
          </div>
        </div>
      </section>

      {/* image preview */}
      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-5 backdrop-blur-xl"
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            aria-label="Close preview"
            onClick={() => setPreview(null)}
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/60 hover:bg-white/[0.1] hover:text-white"
          >
            ×
          </button>

          <img
            src={preview}
            alt="Generated image preview"
            className="max-h-[90vh] max-w-[92vw] rounded-2xl border border-cyan-300/10 object-contain shadow-[0_0_80px_rgba(0,217,255,0.08)]"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[calc(100vh-260px)] items-center justify-center">
      <div className="w-full max-w-xl text-center">
        <div className="neural-orb mx-auto mb-7">
          <div className="neural-orb-core" />
        </div>

        <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.32em] text-cyan-300/55">
          bob ai
        </div>

        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
          what are we building today?
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/35">
          ask a question, build something, analyze a file, or just throw an
          idea at bob.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {["build something", "explain an idea", "analyze a file"].map(
            (suggestion) => (
              <div
                key={suggestion}
                className="rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-xs text-white/35"
              >
                {suggestion}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function UserMessage({
  message,
  menuOpen,
  onMenu,
  onPin,
  onCopy,
  onDelete,
}: {
  message: ChatMessage;
  menuOpen: boolean;
  onMenu: () => void;
  onPin: () => void;
  onCopy: () => Promise<void>;
  onDelete: () => void;
}) {
  return (
    <div className="relative rounded-2xl border border-cyan-300/[0.08] bg-cyan-300/[0.045] px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
      <div className="pr-7 whitespace-pre-wrap text-[15px] leading-7 text-white/85">
        {message.content}
      </div>

      <MessageMenuButton open={menuOpen} onClick={onMenu} />

      {menuOpen && (
        <MessageMenu
          pinned={message.pinned}
          onPin={onPin}
          onCopy={onCopy}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

function AssistantMessage({
  message,
  menuOpen,
  loadedImages,
  onImageLoaded,
  onPreview,
  onMenu,
  onPin,
  onCopy,
  onDelete,
}: {
  message: ChatMessage;
  menuOpen: boolean;
  loadedImages: Record<string, boolean>;
  onImageLoaded: (id: string) => void;
  onPreview: (url: string) => void;
  onMenu: () => void;
  onPin: () => void;
  onCopy: () => Promise<void>;
  onDelete: () => void;
}) {
  return (
    <div className="relative">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-300/[0.05]">
          <span className="text-[10px] font-bold text-cyan-300">B</span>
        </div>

        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
          bob
        </span>

        <span className="h-1 w-1 rounded-full bg-cyan-300/50" />
        <span className="text-[10px] text-white/20">ai</span>
      </div>

      <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.018] px-4 py-4 shadow-[0_12px_45px_rgba(0,0,0,0.12)] sm:px-5">
        {message.content && (
          <div className="pr-7 whitespace-pre-wrap text-[15px] leading-7 text-white/78">
            {message.content}
          </div>
        )}

        {message.images && message.images.length > 0 && (
          <div
            className={`grid gap-3 ${
              message.images.length === 1
                ? "grid-cols-1"
                : "grid-cols-1 sm:grid-cols-2"
            } ${message.content ? "mt-4" : ""}`}
          >
            {message.images.map((image) => (
              <div
                key={image.id}
                className="group/image overflow-hidden rounded-2xl border border-white/[0.07] bg-black/20"
              >
                <button
                  type="button"
                  onClick={() => onPreview(image.url)}
                  className="relative block w-full overflow-hidden"
                >
                  {!loadedImages[image.id] && (
                    <div className="absolute inset-0 animate-pulse bg-white/[0.035]" />
                  )}

                  <img
                    src={image.url}
                    alt={image.prompt}
                    className="max-h-[520px] min-h-48 w-full object-cover transition duration-500 group-hover/image:scale-[1.015]"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onLoad={() => onImageLoaded(image.id)}
                    onError={(event) => {
                      const target = event.currentTarget;

                      target.src = `https://image.pollinations.ai/prompt/${encodeURIComponent(
                        image.prompt
                      )}?seed=${
                        Date.now() + Math.floor(Math.random() * 10000)
                      }&model=flux&width=1024&height=1024&nologo=true`;
                    }}
                  />

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition group-hover/image:opacity-100" />
                </button>

                <div className="flex items-center justify-between border-t border-white/[0.06] px-3 py-2">
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText(image.prompt)
                    }
                    className="rounded-lg px-2.5 py-1.5 text-[11px] text-white/30 hover:bg-white/[0.04] hover:text-white/70"
                  >
                    copy prompt
                  </button>

                  <a
                    href={image.url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg px-2.5 py-1.5 text-[11px] text-white/30 hover:bg-white/[0.04] hover:text-cyan-200"
                  >
                    download
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        <MessageMenuButton open={menuOpen} onClick={onMenu} />

        {menuOpen && (
          <MessageMenu
            pinned={message.pinned}
            onPin={onPin}
            onCopy={onCopy}
            onDelete={onDelete}
          />
        )}
      </div>
    </div>
  );
}

function MessageMenuButton({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Message actions"
      aria-expanded={open}
      className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-sm text-white/25 ${
        open
          ? "bg-white/[0.06] text-white/70"
          : "opacity-0 group-hover:opacity-100"
      } hover:bg-white/[0.06] hover:text-white/80`}
    >
      ···
    </button>
  );
}

function MessageMenu({
  pinned,
  onPin,
  onCopy,
  onDelete,
}: {
  pinned?: boolean;
  onPin: () => void;
  onCopy: () => Promise<void>;
  onDelete: () => void;
}) {
  return (
    <div className="absolute right-2 top-10 z-30 w-44 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b1118]/95 p-1.5 shadow-2xl backdrop-blur-2xl">
      <button
        type="button"
        onClick={onPin}
        className="w-full rounded-lg px-3 py-2 text-left text-xs text-white/65 hover:bg-white/[0.05] hover:text-white"
      >
        {pinned ? "unpin" : "pin"}
      </button>

      <button
        type="button"
        onClick={onCopy}
        className="w-full rounded-lg px-3 py-2 text-left text-xs text-white/65 hover:bg-white/[0.05] hover:text-white"
      >
        copy
      </button>

      <button
        type="button"
        onClick={onDelete}
        className="w-full rounded-lg px-3 py-2 text-left text-xs text-red-300/70 hover:bg-red-400/[0.06] hover:text-red-300"
      >
        delete
      </button>
    </div>
  );
}