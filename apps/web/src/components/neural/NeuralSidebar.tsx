"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Conversation } from "@/types/chat";
import {
  MessageSquare,
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
          onClick={() => { onSelect(conversation.id); setMenuId(null); }}
          title={conversation.title}
          className={[
            "flex min-h-10 w-full items-center gap-2 rounded-lg px-3 py-2 pr-9 text-left text-[13px] transition",
            active ? "bg-white/[0.09] text-white" : "text-white/65 hover:bg-white/[0.055] hover:text-white",
          ].join(" ")}
        >
          <MessageSquare className="h-4 w-4 shrink-0 text-white/40" />
          <span className="min-w-0 flex-1 truncate">{conversation.title || "New conversation"}</span>
          {conversation.pinned && <Pin className="h-3 w-3 shrink-0 text-cyan-200/70" />}
        </button>
        <button
          type="button"
          aria-label={`More actions for ${conversation.title || "conversation"}`}
          title="Conversation actions"
          onClick={() => setMenuId(menuId === conversation.id ? null : conversation.id)}
          className={[
            "absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-white/55 hover:bg-white/10 hover:text-white",
            menuId === conversation.id ? "visible" : "invisible group-hover:visible focus:visible",
          ].join(" ")}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuId === conversation.id && (
          <div className="absolute right-1 top-9 z-30 w-44 rounded-xl border border-white/10 bg-[#17191d] p-1 shadow-xl">
            <button type="button" onClick={() => { onPin(conversation.id); setMenuId(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/80 hover:bg-white/10">
              <Pin className="h-3.5 w-3.5" /> {conversation.pinned ? "Unpin chat" : "Pin chat"}
            </button>
            <button type="button" onClick={() => rename(conversation)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/80 hover:bg-white/10">
              <Pencil className="h-3.5 w-3.5" /> Rename
            </button>
            <button type="button" onClick={() => { setDeleteTarget(conversation); setMenuId(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-red-300 hover:bg-red-400/10">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className="flex h-full w-full flex-col bg-[#090a0c] text-white">
      <div className="flex items-center justify-between px-4 pb-3 pt-5">
        <Link href="/chat" className="text-[17px] font-semibold tracking-tight text-white" aria-label="Bob AI home">Bob AI</Link>
        <span className="rounded-md border border-white/[0.08] px-2 py-1 text-[10px] text-white/35">AI</span>
      </div>

      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={onNewChat}
          className="flex h-10 w-full items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.035] px-3 text-sm text-white/85 transition hover:bg-white/[0.075]"
        >
          <PenSquare className="h-4 w-4 text-white/60" />
          New chat
        </button>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search chats"
            aria-label="Search conversations"
            className="h-9 w-full rounded-lg border border-white/[0.07] bg-white/[0.025] pl-9 pr-3 text-xs text-white placeholder:text-white/35 outline-none focus:border-cyan-300/35"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {pinned.length > 0 && (
          <section className="mb-4">
            <h2 className="px-3 py-2 text-[11px] font-medium text-white/35">Pinned</h2>
            <div className="space-y-0.5">{pinned.map(renderConversation)}</div>
          </section>
        )}
        <section>
          <h2 className="px-3 py-2 text-[11px] font-medium text-white/35">Recent</h2>
          {recent.length ? (
            <div className="space-y-0.5">{recent.map(renderConversation)}</div>
          ) : pinned.length === 0 ? (
            <p className="px-3 py-2 text-xs leading-5 text-white/35">{search ? "No matching conversations." : "Your conversations will appear here."}</p>
          ) : null}
        </section>
      </div>

      <div className="border-t border-white/[0.07] p-3">
        <Link href="/settings" className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-white/65 transition hover:bg-white/[0.06] hover:text-white">
          <Settings className="h-4 w-4 text-white/45" />
          Settings
        </Link>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="delete-chat-title" className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#17191d] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="delete-chat-title" className="text-base font-semibold text-white">Delete conversation?</h2>
                <p className="mt-2 text-sm leading-5 text-white/55">This will remove “{deleteTarget.title || "New conversation"}” from your history.</p>
              </div>
              <button type="button" onClick={() => setDeleteTarget(null)} aria-label="Close dialog" className="rounded-md p-1 text-white/50 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/75 hover:bg-white/[0.06]">Cancel</button>
              <button type="button" onClick={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }} className="rounded-lg bg-red-500/90 px-3 py-2 text-sm font-medium text-white hover:bg-red-500">Delete</button>
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}
