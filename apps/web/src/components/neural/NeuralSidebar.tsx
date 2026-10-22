"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Conversation } from "@/types/chat";
import {
  MoreHorizontal,
  PenSquare,
  Pin,
  Search,
  Settings,
  Trash2,
  Pencil,
  X,
} from "lucide-react";

type Props = {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  search: string;
  setSearch: (value: string) => void;
  onPin: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
};

export default function NeuralSidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  search,
  setSearch,
  onPin,
  onRename,
  onDelete,
}: Props) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) => conversation.title.toLowerCase().includes(query));
  }, [conversations, search]);

  const pinned = filtered.filter((conversation) => conversation.pinned);
  const recent = filtered.filter((conversation) => !conversation.pinned);

  function rename(conversation: Conversation) {
    const nextTitle = window.prompt("Rename conversation", conversation.title)?.trim();
    if (nextTitle && nextTitle !== conversation.title) onRename(conversation.id, nextTitle);
    setMenuId(null);
  }

  function renderConversation(conversation: Conversation) {
    const active = conversation.id === activeId;
    return (
      <div key={conversation.id} className="group relative">
        <button
          type="button"
          data-close-drawer
          onClick={() => { onSelect(conversation.id); setMenuId(null); }}
          title={conversation.title}
          aria-current={active ? "true" : undefined}
          className="convo-item pr-9"
        >
          <span className="min-w-0 flex-1 truncate">{conversation.title || "New conversation"}</span>
          {conversation.pinned && <Pin className="h-3 w-3 shrink-0" aria-label="Pinned" />}
        </button>
        <button
          type="button"
          aria-label={`More actions for ${conversation.title || "conversation"}`}
          title="Conversation actions"
          aria-expanded={menuId === conversation.id}
          onClick={() => setMenuId(menuId === conversation.id ? null : conversation.id)}
          className={`absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full ${active ? "text-[var(--bg)]" : "text-[var(--muted)] hover:text-[var(--text)]"} ${menuId === conversation.id ? "visible" : "invisible group-hover:visible focus:visible"}`}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </button>
        {menuId === conversation.id && (
          <div className="absolute right-1 top-10 z-30 w-44 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow)]">
            <button type="button" onClick={() => { onPin(conversation.id); setMenuId(null); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]">
              <Pin className="h-3.5 w-3.5" aria-hidden /> {conversation.pinned ? "Unpin" : "Pin"}
            </button>
            <button type="button" onClick={() => rename(conversation)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]">
              <Pencil className="h-3.5 w-3.5" aria-hidden /> Rename
            </button>
            <button type="button" onClick={() => { setDeleteTarget(conversation); setMenuId(null); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--surface-2)]">
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-[var(--surface)] text-[var(--text)]">
      <div className="flex items-baseline justify-between px-5 pb-4 pt-5">
        <span className="caption">Conversations</span>
        <span className="caption">{conversations.length}</span>
      </div>

      <div className="px-3 pb-3">
        <button type="button" data-close-drawer onClick={onNewChat} className="btn-ink !min-h-11 w-full justify-center text-sm">
          <PenSquare className="h-4 w-4" aria-hidden /> New conversation
        </button>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--faint)]" aria-hidden />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search"
            aria-label="Search conversations"
            className="h-10 w-full rounded-full border border-[var(--hairline)] bg-transparent pl-9 pr-3 text-sm outline-none placeholder:text-[var(--faint)] focus:border-[var(--text)]"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {pinned.length > 0 && (
          <section className="mb-4">
            <h2 className="caption px-3 py-2">Pinned</h2>
            <div className="space-y-0.5">{pinned.map(renderConversation)}</div>
          </section>
        )}
        <section>
          <h2 className="caption px-3 py-2">Recent</h2>
          {recent.length ? (
            <div className="space-y-0.5">{recent.map(renderConversation)}</div>
          ) : pinned.length === 0 ? (
            <p className="px-3 py-2 text-sm leading-6 text-[var(--muted)]">{search ? "No matching conversations." : "Your conversations will appear here."}</p>
          ) : null}
        </section>
      </div>

      <div className="border-t border-[var(--hairline)] p-3">
        <Link href="/settings" className="convo-item">
          <Settings className="h-4 w-4" aria-hidden />
          Settings
        </Link>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(21,19,15,0.45)] p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="delete-chat-title" className="w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="delete-chat-title" className="font-display text-3xl">Delete this conversation?</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">“{deleteTarget.title || "New conversation"}” will be removed from your history.</p>
              </div>
              <button type="button" onClick={() => setDeleteTarget(null)} aria-label="Close dialog" className="atelier-iconbtn"><X className="h-4 w-4" aria-hidden /></button>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="btn-line !min-h-10 text-sm">Cancel</button>
              <button type="button" onClick={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }} className="btn-ink !min-h-10 text-sm">Delete</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
