"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, MoreHorizontal, Pin, RotateCcw, Trash2, X } from "lucide-react";
import type { ChatMessage, LiveDataInfo, ToolApproval } from "@/types/chat";
import VoiceButton from "@/components/VoiceButton";
import Markdown from "@/components/Markdown";
import JarvisStage from "@/components/core/JarvisStage";

type Props = {
  messages: ChatMessage[];
  loading: boolean;
  loadingLabel?: string;
  onPinMessage: (id: string) => void;
  onDeleteMessage: (id: string) => void;
  /** Omit to hide the "Try again" button (e.g. in demo mode). */
  onRegenerate?: () => void;
  onResolveApproval: (messageId: string, approve: boolean) => void;
  /** Speak each new reply automatically with the local Alan Medium voice. */
  voiceReplies?: boolean;
  /** Only this reply (the one just produced) may be auto-played; switching chats never replays old replies. */
  autoPlayMessageId?: string | null;
  /** Suggestions shown on an empty conversation; clicking one fills the composer. */
  onSuggestion?: (text: string) => void;
};

const SUGGESTIONS = [
  "What's the weather in Hyderabad right now?",
  "Explain recursion like I'm new to programming.",
  "Write a Python function that removes duplicates from a list.",
];

export default function ChatWindow({ messages, loading, loadingLabel = "Working on it", onPinMessage, onDeleteMessage, onRegenerate, onResolveApproval, voiceReplies = false, autoPlayMessageId = null, onSuggestion }: Props) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Follow new messages, but leave an empty chat at the top so its heading is not scrolled under the core.
  useEffect(() => {
    if (messages.length || loading) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    else if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
  }, [messages, loading]);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") { setPreview(null); setMenuId(null); } }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const pinnedMessages = messages.filter((message) => message.pinned);
  const lastAssistantId = [...messages].reverse().find((message) => message.role === "assistant")?.id;
  const actions = (message: ChatMessage) => ({
    open: menuId === message.id,
    toggle: () => setMenuId(menuId === message.id ? null : message.id),
    pin: () => { onPinMessage(message.id); setMenuId(null); },
    copy: async () => { try { await navigator.clipboard.writeText(message.content); } catch { /* clipboard unavailable */ } setMenuId(null); },
    remove: () => { onDeleteMessage(message.id); setMenuId(null); },
  });

  return (
    <>
      <section className="relative h-full min-h-0 overflow-hidden" aria-label="Conversation">
        {/* One persistent 3D core: large and centred on an empty chat, docked small once a chat starts. */}
        <div className="jarvis-stage-layer"><JarvisStage compact={messages.length > 0} /></div>

        <div ref={scrollerRef} className="relative h-full overflow-y-auto">
          <div className="mx-auto w-full max-w-[780px] px-4 pb-16 pt-8 sm:px-8">
            {pinnedMessages.length > 0 && (
              <nav aria-label="Pinned messages" className="mb-10 border-y border-[var(--hairline)] py-3">
                <p className="caption mb-2">Pinned</p>
                <ul className="space-y-1">
                  {pinnedMessages.map((message) => (
                    <li key={message.id}><a href={`#msg-${message.id}`} className="block truncate text-sm text-[var(--muted)] hover:text-[var(--text)]">{message.content.slice(0, 120) || "Image"}</a></li>
                  ))}
                </ul>
              </nav>
            )}

            {messages.length === 0 ? (
              <EmptyState onSuggestion={onSuggestion} />
            ) : (
              <div className="space-y-10">
                {messages.map((message) => {
                  const isLastAssistant = message.role === "assistant" && message.id === lastAssistantId;
                  return (
                    <article id={`msg-${message.id}`} key={message.id} className="chat-enter group relative">
                      {message.role === "user" ? (
                        <UserMessage message={message} {...actions(message)} />
                      ) : (
                        <AssistantMessage
                          message={message}
                          autoPlayId={voiceReplies && !loading && message.id === autoPlayMessageId ? message.id : undefined}
                          onResolveApproval={(approve) => onResolveApproval(message.id, approve)}
                          onPreview={setPreview}
                          onRegenerate={isLastAssistant && onRegenerate ? onRegenerate : undefined}
                          loading={loading}
                          {...actions(message)}
                        />
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {loading && (
              <div className="mt-10 flex items-center gap-3" role="status" aria-live="polite">
                <span className="msg-sigil">J</span>
                <span className="caption">{loadingLabel}</span>
                <span className="flex gap-1" aria-hidden>
                  {[0, 1, 2].map((dot) => <span key={dot} className="h-1 w-1 animate-pulse rounded-full bg-[var(--accent)]" style={{ animationDelay: `${dot * 160}ms` }} />)}
                </span>
              </div>
            )}
            <div ref={endRef} className="h-2" />
          </div>
        </div>
      </section>

      {preview && (
        <div role="dialog" aria-modal="true" aria-label="Image preview" className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(21,19,15,0.86)] p-5" onClick={() => setPreview(null)}>
          <button type="button" aria-label="Close preview" onClick={() => setPreview(null)} className="atelier-iconbtn absolute right-5 top-5 !text-[#f2ede3]"><X className="h-5 w-5" aria-hidden /></button>
          <img src={preview} alt="Generated image, enlarged" className="max-h-[90vh] max-w-[92vw] rounded-2xl object-contain" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion?: (text: string) => void }) {
  return (
    <div className="flex justify-center pb-6">
      <div className="w-full max-w-xl text-center">
        <div className="jarvis-empty-spacer" aria-hidden="true" />
        <h1 className="font-display text-5xl leading-none sm:text-6xl">What shall we <em className="text-[var(--accent)]">think</em> about?</h1>
        <p className="mx-auto mt-4 max-w-md text-[var(--muted)]">Ask a question, paste some code, attach a file, or press the microphone and talk.</p>
        <div className="mt-8 flex flex-col items-stretch gap-2 sm:items-center">
          {SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => onSuggestion?.(suggestion)} disabled={!onSuggestion} className="group flex items-center justify-between gap-4 border-b border-[var(--hairline)] py-3 text-left text-[15px] hover:border-[var(--text)] disabled:cursor-default sm:min-w-[440px]">
              <span>{suggestion}</span>
              <span aria-hidden className="text-[var(--accent)] transition-transform duration-500 group-hover:translate-x-1">→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type ActionProps = { open: boolean; toggle: () => void; pin: () => void; copy: () => Promise<void>; remove: () => void };

function UserMessage({ message, ...menu }: { message: ChatMessage } & ActionProps) {
  return (
    <div className="flex flex-col items-end">
      <div className="relative flex items-start gap-1">
        <MessageMenu {...menu} pinned={message.pinned} align="left" />
        <div className="msg-user">{message.content || (message.files?.length ? `Attached ${message.files.map((file) => file.name).join(", ")}` : "")}</div>
      </div>
      {message.pinned && <span className="caption mt-2">Pinned</span>}
    </div>
  );
}

function AssistantMessage({ message, autoPlayId, onResolveApproval, onPreview, onRegenerate, loading, ...menu }: { message: ChatMessage; autoPlayId?: string; onResolveApproval: (approve: boolean) => void; onPreview: (url: string) => void; onRegenerate?: () => void; loading: boolean } & ActionProps) {
  return (
    <div className="relative">
      <div className="msg-meta">
        <span className="msg-sigil" aria-hidden>J</span>
        <span className="caption">Jarvis{message.pinned ? " · pinned" : ""}</span>
        <div className="ml-auto flex items-center gap-1">
          {message.content.trim() && <VoiceButton onTranscript={() => undefined} readAloudText={message.content} autoPlayId={autoPlayId} />}
          <MessageMenu {...menu} pinned={message.pinned} align="right" />
        </div>
      </div>

      {message.content && <div className="msg-assistant"><Markdown text={message.content} /></div>}

      {message.images && message.images.length > 0 && (
        <div className={`grid gap-3 ${message.images.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"} ${message.content ? "mt-5" : ""}`}>
          {message.images.map((image) => (
            <figure key={image.id} className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface)]">
              <button type="button" onClick={() => onPreview(image.url)} className="block w-full" aria-label="Enlarge image">
                      <img src={image.url} alt={image.prompt || "Generated image"} className="max-h-[520px] min-h-48 w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
              </button>
              <figcaption className="flex items-center justify-between gap-3 border-t border-[var(--hairline)] px-3 py-2">
                <span className="caption min-w-0 truncate normal-case tracking-normal">{image.prompt}</span>
                <a href={image.url} download className="caption shrink-0 hover:text-[var(--text)]">Download</a>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {message.liveData && <LiveDataBadge info={message.liveData} />}
      {message.approval && <ApprovalCard approval={message.approval} onResolve={onResolveApproval} />}

      {onRegenerate && (
        <button type="button" onClick={onRegenerate} disabled={loading} className="atelier-chip mt-5 disabled:opacity-40" aria-label="Regenerate response">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Try again
        </button>
      )}
    </div>
  );
}

function MessageMenu({ open, toggle, pin, copy, remove, pinned, align }: ActionProps & { pinned?: boolean; align: "left" | "right" }) {
  return (
    <div className="relative">
      <button type="button" onClick={toggle} aria-label="Message actions" aria-expanded={open} className={`atelier-iconbtn !h-8 !w-8 ${open ? "" : "opacity-0 focus:opacity-100 group-hover:opacity-100"} max-sm:opacity-100`}>
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {open && (
        <div className={`absolute top-9 z-30 w-40 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow)] ${align === "left" ? "right-0" : "right-0"}`}>
          <button type="button" onClick={pin} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]"><Pin className="h-3.5 w-3.5" aria-hidden /> {pinned ? "Unpin" : "Pin"}</button>
          <button type="button" onClick={() => void copy()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]"><Copy className="h-3.5 w-3.5" aria-hidden /> Copy</button>
          <button type="button" onClick={remove} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[var(--accent)] hover:bg-[var(--surface-2)]"><Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete</button>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (!Number.isFinite(seconds)) return "";
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  return new Date(iso).toLocaleString();
}

/** Shows where live data came from and whether it is live, cached, or only web-search snippets. */
function LiveDataBadge({ info }: { info: LiveDataInfo }) {
  const label = info.freshness === "web-search" ? "Web search — may be delayed" : info.cached ? "Cached" : "Live";
  return (
    <div className="live-badge mt-4" data-freshness={info.freshness} data-cached={info.cached}>
      <div className="live-badge-head">
        <span className={`live-badge-pill ${info.freshness === "web-search" ? "is-search" : info.cached ? "is-cached" : "is-live"}`}>{label}</span>
        <span>{info.provider}</span>
        <span aria-hidden>·</span>
        <time dateTime={info.fetchedAt} title={new Date(info.fetchedAt).toLocaleString()}>fetched {timeAgo(info.fetchedAt)}</time>
      </div>
      {info.sources.length > 0 && (
        <ol className="live-badge-sources">
          {info.sources.slice(0, 6).map((source, index) => (
            <li key={`${source.url}-${index}`}>
              <a href={source.url} target="_blank" rel="noopener noreferrer nofollow">
                <span className="live-badge-index">{index + 1}</span>
                <span className="truncate">{source.title || new URL(source.url).hostname}</span>
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Consent gate for tools that act on the user's behalf. Nothing runs until Approve is pressed. */
function ApprovalCard({ approval, onResolve }: { approval: ToolApproval; onResolve: (approve: boolean) => void }) {
  const args = JSON.stringify(approval.arguments, null, 2);
  return (
    <div className="approval-card mt-4" role="group" aria-label={`Approval needed for ${approval.name}`}>
      <p className="approval-title">Approval needed: <strong>{approval.name}</strong> <span className="approval-risk">{approval.risk}</span></p>
      <pre className="approval-args">{args.length > 1200 ? `${args.slice(0, 1200)}…` : args}</pre>
      {approval.state === "pending" && (
        <div className="approval-actions">
          <button type="button" className="approval-approve" onClick={() => onResolve(true)}>Approve and run once</button>
          <button type="button" className="approval-decline" onClick={() => onResolve(false)}>Decline</button>
        </div>
      )}
      {approval.state === "running" && <p className="approval-status" role="status">Running…</p>}
      {approval.state === "completed" && <p className="approval-status" role="status">Completed. The result is below.</p>}
      {approval.state === "declined" && <p className="approval-status" role="status">Declined. Nothing was run.</p>}
      {approval.state === "failed" && <p className="approval-status approval-error" role="alert">Failed: {approval.error}</p>}
    </div>
  );
}
