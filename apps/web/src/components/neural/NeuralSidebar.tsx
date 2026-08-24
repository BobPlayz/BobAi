"use client";

import { useMemo, useState } from "react";
import type { Conversation } from "@/types/chat";
import {
  PenSquare,
  MessageSquare,
  Search,
  Image,
  Library,
  Plug,
  Folder,
  Code2,
  Settings,
  MoreHorizontal,
} from "lucide-react";
import BorderGlow from "@/components/BorderGlow";

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
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      c.title.toLowerCase().includes(q)
    );
  }, [conversations, search]);

  const pinned = filtered.filter((c) => c.pinned);
  const recent = filtered.filter((c) => !c.pinned);

  return (
    <>
      <aside className="flex h-full w-full bg-[#04070C]">
        {/* Left neural rail */}
        <div className="relative flex w-[64px] flex-col items-center bg-[#04070C] py-3">
          <div className="absolute inset-y-0 right-0 w-px bg-cyan-400/18" />
          <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-r from-transparent to-cyan-400/6 blur-md" />

          <RailButton active onClick={onNewChat}>
            <PenSquare className="h-5 w-5" />
          </RailButton>
          <RailButton>
            <MessageSquare className="h-5 w-5" />
          </RailButton>
          <RailButton>
            <Search className="h-5 w-5" />
          </RailButton>
          <RailButton>
            <Image className="h-5 w-5" />
          </RailButton>
          <RailButton>
            <Library className="h-5 w-5" />
          </RailButton>
          <RailButton>
            <Plug className="h-5 w-5" />
          </RailButton>
          <RailButton>
            <Folder className="h-5 w-5" />
          </RailButton>
          <RailButton>
            <Code2 className="h-5 w-5" />
          </RailButton>

          <div className="mt-auto mb-2">
            <div className="neural-orb">
              <div className="neural-orb-core" />
            </div>
          </div>

          <RailButton>
            <Settings className="h-5 w-5" />
          </RailButton>
        </div>

        {/* Attached sidebar */}
        <div className="relative flex flex-1 flex-col bg-[#05080D]">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-cyan-400/12" />

          {/* Header */}
          <div className="border-b border-cyan-400/10 px-4 py-4">
            <div className="text-[22px] font-semibold tracking-tight text-white">
              Bob AI
            </div>
            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-300/68">
              Neural Interface
            </div>

            <button
              onClick={onNewChat}
              className="mt-4 h-10 w-full rounded-xl border border-cyan-300/24 bg-[#0A1622] text-sm font-semibold text-cyan-100 shadow-[0_0_18px_rgba(0,217,255,0.16)] transition hover:border-cyan-200/45 hover:shadow-[0_0_28px_rgba(0,217,255,0.28)]"
            >
              + New chat
            </button>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300/36" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations"
                className="h-10 w-full rounded-xl border border-cyan-400/10 bg-[#081018] pl-9 pr-3 text-sm text-white placeholder:text-cyan-300/24 outline-none focus:border-cyan-300/24"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto px-2 py-3">
            {pinned.length > 0 && (
              <Section
                title="Pinned"
                conversations={pinned}
                activeId={activeId}
                onSelect={onSelect}
                onPin={onPin}
                onRename={onRename}
                onDelete={(c) => setDeleteTarget(c)}
                menuId={menuId}
                setMenuId={setMenuId}
              />
            )}

            <Section
              title="Recents"
              conversations={recent}
              activeId={activeId}
              onSelect={onSelect}
              onPin={onPin}
              onRename={onRename}
              onDelete={(c) => setDeleteTarget(c)}
              menuId={menuId}
              setMenuId={setMenuId}
            />
          </div>

          {/* Footer */}
          <div className="border-t border-cyan-400/10 p-3">
            <div className="flex items-center gap-3 rounded-xl border border-cyan-400/10 bg-[#081018] px-3 py-2">
              <div className="neural-orb">
                <div className="neural-orb-core" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-white">
                  Bob
                </div>
                <div className="text-xs text-cyan-300/44">
                  Neural profile
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-[420px] rounded-2xl border border-cyan-400/14 bg-[#070C12] p-6 shadow-[0_0_30px_rgba(0,217,255,0.14)]">
            <h2 className="text-lg font-semibold text-white">
              Delete conversation?
            </h2>
            <p className="mt-2 text-sm text-cyan-300/55">
              This will permanently delete &quot;{deleteTarget.title}&quot; and remove
              any memory associated with this conversation.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-cyan-400/10 px-4 py-2 text-sm text-white/80 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RailButton({
  children,
  active = false,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "mb-2 flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/28 bg-[#0A1622] text-cyan-100 shadow-[0_0_18px_rgba(0,217,255,0.22)]"
          : "mb-2 flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/10 bg-[#081018] text-cyan-300/72 transition hover:border-cyan-300/22 hover:text-cyan-100"
      }
    >
      {children}
    </button>
  );
}

function Section({
  title,
  conversations,
  activeId,
  onSelect,
  onPin,
  onRename,
  onDelete,
  menuId,
  setMenuId,
}: {
  title: string;
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onPin: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (c: Conversation) => void;
  menuId: string | null;
  setMenuId: (id: string | null) => void;
}) {
  if (conversations.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300/42">
        {title}
      </div>
      <div className="space-y-1">
        {conversations.map((conversation) => (
          <ConversationRow
            key={conversation.id}
            conversation={conversation}
            active={conversation.id === activeId}
            onSelect={onSelect}
            onPin={onPin}
            onRename={onRename}
            onDelete={onDelete}
            menuId={menuId}
            setMenuId={setMenuId}
          />
        ))}
      </div>
    </div>
  );
}

function ConversationRow({
  conversation,
  active,
  onSelect,
  onPin,
  onRename,
  onDelete,
  menuId,
  setMenuId,
}: {
  conversation: Conversation;
  active: boolean;
  onSelect: (id: string) => void;
  onPin: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (c: Conversation) => void;
  menuId: string | null;
  setMenuId: (id: string | null) => void;
}) {
  return (
    <div className="relative group">
      <BorderGlow className="rounded-xl">
        <button
          onClick={() => onSelect(conversation.id)}
          className={
            active
              ? "flex h-10 w-full items-center rounded-xl border border-cyan-300/22 bg-[#0A1622] px-3 text-left text-sm text-white shadow-[0_0_14px_rgba(0,217,255,0.10)]"
              : "flex h-10 w-full items-center rounded-xl px-3 text-left text-sm text-cyan-100/86 hover:bg-[#09131C] hover:text-white"
          }
        >
          <MessageSquare className="mr-3 h-4 w-4 text-cyan-300/68" />
          <span className="truncate">{conversation.title}</span>
        </button>
      </BorderGlow>

      <button
        onClick={() =>
          setMenuId(menuId === conversation.id ? null : conversation.id)
        }
        className="absolute right-2 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-cyan-300/50 hover:bg-white/10 hover:text-cyan-100 group-hover:flex"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {menuId === conversation.id && (
        <div className="absolute right-2 top-10 z-20 w-40 rounded-xl border border-cyan-400/10 bg-[#081018] py-1 shadow-[0_0_22px_rgba(0,217,255,0.12)]">
          <button
            onClick={() => {
              onPin(conversation.id);
              setMenuId(null);
            }}
            className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5"
          >
            {conversation.pinned ? "Unpin" : "Pin"}
          </button>
          <button
            onClick={() => {
              const next = prompt("Rename conversation", conversation.title);
              if (next && next.trim()) onRename(conversation.id, next.trim());
              setMenuId(null);
            }}
            className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5"
          >
            Rename
          </button>
          <button
            onClick={() => {
              onDelete(conversation);
              setMenuId(null);
            }}
            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-white/5"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}