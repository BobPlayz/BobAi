"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, Copy, Flag, MoreHorizontal, Pencil, Pin, RotateCcw, Trash2, X } from "lucide-react";
import type { ChatMessage, LiveDataInfo, ToolApproval } from "@/types/chat";
import VoiceButton from "@/components/VoiceButton";
import Markdown from "@/components/Markdown";
import JarvisStage from "@/components/core/JarvisStage";
import JarvisMark from "@/components/JarvisMark";
import { toast } from "@/lib/toast";

/** One line of plain text for previews: no markdown symbols or code blocks. */
function plainPreview(text: string) {
  return text.replace(/```[\s\S]*?(```|$)/g, " [code] ").replace(/`([^`]*)`/g, "$1").replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_#>~|]+/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
}

type Props = {
  messages: ChatMessage[];
  loading: boolean;
  /** Persistent voice session: the minimized control occupies its own row and never covers chat controls. */
  voiceControl?: ReactNode;
  loadingLabel?: string;
  onPinMessage: (id: string) => void;
  onDeleteMessage: (id: string) => void;
  /** Omit to hide the "Try again" button (e.g. in demo mode). */
  onRegenerate?: () => void;
  onResolveApproval: (messageId: string, approve: boolean) => void;
  /** Speak each new reply automatically. */
  voiceReplies?: boolean;
  /** Only this reply (the one just produced) may be auto-played; switching chats never replays old replies. */
  autoPlayMessageId?: string | null;
  /** Suggestions shown on an empty conversation; clicking one fills the composer. */
  onSuggestion?: (text: string) => void;
  /** Demo mode: read aloud with the browser's voice so nothing reaches the server. */
  browserVoice?: boolean;
  /** Flags a Jarvis reply as harmful or wrong (Play Store rule for AI apps). Omit to hide Report (the demo). */
  onReport?: (messageId: string) => Promise<void>;
  /** Puts your latest question back in the box to fix and resend. Omit to hide Edit (the demo). */
  onEditLast?: (messageId: string) => void;
};

const SUGGESTIONS = [
  "What's the weather in Hyderabad right now?",
  "Explain black holes like I'm 13.",
  "Help me write a Python program that removes duplicates from a list.",
];

export default function ChatWindow({ messages, loading, loadingLabel = "Working on it", voiceControl, onPinMessage, onDeleteMessage, onRegenerate, onResolveApproval, voiceReplies = false, autoPlayMessageId = null, onSuggestion, browserVoice = false, onReport, onEditLast }: Props) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [reported, setReported] = useState<Set<string>>(() => new Set());
  const [preview, setPreview] = useState<string | null>(null);
  // Close an open message menu on a tap outside it or on Escape.
  useEffect(() => {
    if (!menuId) return;
    const onPointer = (event: PointerEvent) => { if (!(event.target as HTMLElement).closest("[data-message-menu]")) setMenuId(null); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuId(null); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [menuId]);
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Follow new messages only while the reader is at the bottom: scrolling up to reread never gets yanked back down.
  // An empty chat stays at the top so its heading is not scrolled under the core.
  const following = useRef(true);
  const lastSeenId = useRef<string | undefined>(undefined);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  useEffect(() => {
    if (!messages.length && !loading) { if (scrollerRef.current) scrollerRef.current.scrollTop = 0; following.current = true; setAwayFromBottom(false); return; }
    // Sending a message always brings you back down to it.
    const lastId = messages.at(-1)?.id;
    if (messages.at(-1)?.role === "user" && lastId !== lastSeenId.current) { following.current = true; setAwayFromBottom(false); }
    lastSeenId.current = lastId;
    if (following.current) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);
  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    following.current = near;
    setAwayFromBottom(!near);
  }
  function jumpToLatest() { following.current = true; setAwayFromBottom(false); endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") { setPreview(null); setMenuId(null); } }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const pinnedMessages = messages.filter((message) => message.pinned);
  const lastAssistantId = [...messages].reverse().find((message) => message.role === "assistant")?.id;
  const lastUserId = [...messages].reverse().find((message) => message.role === "user")?.id;
  const actions = (message: ChatMessage) => ({
    open: menuId === message.id,
    toggle: () => setMenuId(menuId === message.id ? null : message.id),
    pin: () => { onPinMessage(message.id); setMenuId(null); toast(message.pinned ? "Unpinned" : "Pinned to the top"); },
    copy: async () => { try { await navigator.clipboard.writeText(message.content); toast("Copied ✓"); } catch { toast("Couldn't copy. Try selecting the text."); } setMenuId(null); },
    remove: () => { onDeleteMessage(message.id); setMenuId(null); toast("Message deleted"); },
    ...(onEditLast && message.role === "user" && message.id === lastUserId && !loading ? { edit: () => { setMenuId(null); onEditLast(message.id); } } : {}),
    ...(onReport && message.role === "assistant" ? {
      report: () => { setMenuId(null); if (reported.has(message.id)) return; setReported((current) => new Set(current).add(message.id)); void onReport(message.id).then(() => toast("Reported. Thanks for flagging it.")).catch(() => { toast("Couldn't send the report. Try again."); setReported((current) => { const next = new Set(current); next.delete(message.id); return next; }); }); },
      reported: reported.has(message.id),
    } : {}),
  });

  return (
    <>
      <section className="relative flex h-full min-h-0 flex-col overflow-hidden" aria-label="Conversation">
        {/* One persistent 3D core: large and centred on an empty chat, docked small once a chat starts. */}
        <div className="jarvis-stage-layer"><JarvisStage compact={messages.length > 0} /></div>

        <div ref={scrollerRef} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[780px] px-4 pb-16 pt-8 sm:px-8">
            {pinnedMessages.length > 0 && (
              <nav aria-label="Pinned messages" className="mb-10 border-y border-[var(--hairline)] py-3">
                <p className="caption mb-2">Pinned</p>
                <ul className="space-y-1">
                  {pinnedMessages.map((message) => (
                    <li key={message.id}><a href={`#msg-${message.id}`} className="block truncate text-sm text-[var(--muted)] hover:text-[var(--text)]">{plainPreview(message.content) || "Image"}</a></li>
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
                          browserVoice={browserVoice}
                          onResolveApproval={(approve) => onResolveApproval(message.id, approve)}
                          onPreview={setPreview}
                          onRegenerate={isLastAssistant && onRegenerate && !message.streaming ? onRegenerate : undefined}
                          loading={loading}
                          {...actions(message)}
                        />
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            <div ref={endRef} className="h-2" />
          </div>
        </div>
        {awayFromBottom && messages.length > 0 && (
          <button type="button" onClick={jumpToLatest} aria-label="Jump to latest" title="Jump to latest" className="absolute bottom-28 left-1/2 z-20 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] shadow-[var(--shadow)] hover:text-[var(--text)] animate-[chatEnter_200ms_ease-out_both] motion-reduce:animate-none"><ArrowDown className="h-4 w-4" aria-hidden /></button>
        )}
        {(loading || voiceControl) && (
          <div className="relative z-10 flex shrink-0 flex-wrap items-center gap-3 border-t border-[var(--hairline)] bg-[var(--bg)]/95 px-3 py-2 sm:px-6">
            {loading && !(messages.at(-1)?.streaming && messages.at(-1)?.content) && (
              <div className="flex min-w-0 flex-1 items-center gap-3" role="status" aria-live="polite">
                <JarvisMark className="msg-sigil" />
                <span className="caption truncate">{loadingLabel}</span>
                <span className="flex shrink-0 gap-1" aria-hidden>
                  {[0, 1, 2].map((dot) => <span key={dot} className="h-1 w-1 animate-pulse rounded-full bg-[var(--accent)]" style={{ animationDelay: `${dot * 160}ms` }} />)}
                </span>
              </div>
            )}
            {voiceControl && <div className="min-w-0 flex-[1_1_22rem]">{voiceControl}</div>}
          </div>
        )}
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
        <h1 className="font-display text-[2.6rem] leading-none sm:text-6xl">What&apos;s on your <em className="text-[var(--accent)]">mind?</em></h1>
        <p className="mx-auto mt-3 max-w-md text-[var(--muted)] sm:mt-4">Ask anything, paste some code, drop in a file, or tap the mic and talk.</p>
        <div className="mt-5 flex flex-col items-stretch gap-1 sm:mt-8 sm:items-center sm:gap-2">
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

type ActionProps = { open: boolean; toggle: () => void; pin: () => void; copy: () => Promise<void>; remove: () => void; report?: () => void; reported?: boolean; edit?: () => void };

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

function AssistantMessage({ message, autoPlayId, browserVoice, onResolveApproval, onPreview, onRegenerate, loading, ...menu }: { message: ChatMessage; autoPlayId?: string; browserVoice?: boolean; onResolveApproval: (approve: boolean) => void; onPreview: (url: string) => void; onRegenerate?: () => void; loading: boolean } & ActionProps) {
  return (
    <div className="relative">
      <div className="msg-meta">
        <JarvisMark className="msg-sigil" />
        <span className="caption">Jarvis{message.pinned ? " · pinned" : ""}</span>
        <div className="ml-auto flex items-center gap-1">
          {message.content.trim() && <VoiceButton onTranscript={() => undefined} readAloudText={message.content} autoPlayId={autoPlayId} browserVoice={browserVoice} />}
          <MessageMenu {...menu} pinned={message.pinned} align="right" />
        </div>
      </div>

      {message.content && <div className="msg-assistant"><Markdown text={message.content} live={message.streaming === true} /></div>}
      {message.incomplete && !message.streaming && <p className="mt-3 rounded-xl border border-[var(--danger)]/40 px-3 py-2 text-sm text-[var(--danger)]" role="status">This answer got cut off before it finished. Tap “Try again” to get the full version.</p>}

      {message.visualPending && <p className="caption mt-4 animate-pulse normal-case tracking-normal" role="status">Finding a picture to help…</p>}
      {message.gallery && message.gallery.length > 0 && (
        <div className="mt-5">
          <p className="caption mb-2">Pictures to help</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {message.gallery.map((picture) => (
              <li key={picture.page} className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface)]">
                <a href={picture.page} target="_blank" rel="noopener noreferrer" className="block" title={`${picture.title}: open on Wikimedia Commons`}>
                  <img src={picture.thumb} alt={picture.title} loading="lazy" referrerPolicy="no-referrer" className="aspect-square w-full object-cover transition-transform duration-300 hover:scale-[1.03]" />
                </a>
                <p className="truncate px-2.5 py-1.5 text-[11px] text-[var(--muted)]" title={`${picture.credit} · ${picture.license}`}>{picture.credit} · {picture.license}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-[var(--muted)]">From Wikimedia Commons. Tap a picture to see where it&apos;s from.</p>
        </div>
      )}
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
      {message.localSite && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--accent)] bg-[var(--surface)] p-4">
          <div className="min-w-0">
            <p className="font-medium">Your site is running on localhost 🎉</p>
            <p className="truncate text-sm text-[var(--muted)]">{message.localSite.url}</p>
          </div>
          <a href={message.localSite.url} target="_blank" rel="noopener noreferrer" className="btn-ink !min-h-10 text-sm">Open localhost <span className="btn-arrow" aria-hidden>→</span></a>
        </div>
      )}
      {message.compacted ? <p className="caption mt-3 normal-case tracking-normal text-[var(--faint)]">Jarvis summarized {message.compacted} earlier messages to keep this chat going.</p> : null}
      {message.approval && <ApprovalCard approval={message.approval} onResolve={onResolveApproval} />}

      {onRegenerate && (
        <button type="button" onClick={onRegenerate} disabled={loading} className="atelier-chip mt-5 disabled:opacity-40" aria-label="Regenerate response">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Try again
        </button>
      )}
    </div>
  );
}

function MessageMenu({ open, toggle, pin, copy, remove, report, reported, edit, pinned, align }: ActionProps & { pinned?: boolean; align: "left" | "right" }) {
  return (
    <div className="relative" data-message-menu>
      <button type="button" onClick={toggle} aria-label="Message actions" aria-expanded={open} className={`atelier-iconbtn !h-8 !w-8 ${open ? "" : "opacity-0 focus:opacity-100 group-hover:opacity-100"} max-sm:opacity-100 [@media(hover:none)]:opacity-100`}>
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {open && (
        <div className={`absolute top-9 z-30 w-40 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow)] ${align === "left" ? "right-0" : "right-0"}`}>
          {edit && <button type="button" onClick={edit} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]"><Pencil className="h-3.5 w-3.5" aria-hidden /> Edit</button>}
          <button type="button" onClick={pin} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]"><Pin className="h-3.5 w-3.5" aria-hidden /> {pinned ? "Unpin" : "Pin"}</button>
          <button type="button" onClick={() => void copy()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]"><Copy className="h-3.5 w-3.5" aria-hidden /> Copy</button>
          <button type="button" onClick={remove} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--surface-2)]"><Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete</button>
          {report && <button type="button" onClick={report} disabled={reported} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)] disabled:opacity-60"><Flag className="h-3.5 w-3.5" aria-hidden /> {reported ? "Reported, thanks" : "Report reply"}</button>}
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

/** Only real web links become clickable; anything else (or a malformed URL) is shown as plain text. */
function safeHttpUrl(value: unknown) {
  try { const url = new URL(String(value)); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null; } catch { return null; }
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
        <time dateTime={info.fetchedAt} title={new Date(info.fetchedAt).toLocaleString()} suppressHydrationWarning>fetched {timeAgo(info.fetchedAt)}</time>
      </div>
      {info.sources.length > 0 && (
        <details className="group mt-2">
          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--text)]">
            <span aria-hidden className="transition-transform group-open:rotate-90">›</span> Sources ({Math.min(info.sources.length, 6)})
          </summary>
          <ol className="live-badge-sources">
            {info.sources.slice(0, 6).map((source, index) => {
              const href = safeHttpUrl(source.url);
              const site = href ? new URL(href).hostname.replace(/^www\./, "") : "";
              const inner = (<><span className="live-badge-index">{index + 1}</span><span className="min-w-0 flex-1 truncate">{source.title || site || "Source"}</span>{site && <span className="shrink-0 text-[11px] text-[var(--faint)]">{site}{source.publishedAt ? ` · ${String(source.publishedAt).slice(0, 10)}` : ""}</span>}</>);
              return <li key={`${source.url}-${index}`}>{href ? <a href={href} target="_blank" rel="noopener noreferrer nofollow">{inner}</a> : <span>{inner}</span>}</li>;
            })}
          </ol>
        </details>
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
