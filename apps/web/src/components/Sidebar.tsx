"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import BobLogo from "@/components/BobLogo";
import type { Conversation } from "@/types/chat";

type Props = {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  search: string;
  setSearch: (value: string) => void;
  onTogglePin: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
};

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  search,
  setSearch,
  onTogglePin,
  onRename,
  onDelete,
}: Props) {
  const router = useRouter();
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  function finishRename() {
    if (!editingId) return;
    const next = editingTitle.trim();
    if (next) onRename(editingId, next);
    setEditingId(null);
    setEditingTitle("");
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r border-white/10 bg-black">
      <div className="p-4">
        <div className="flex items-center gap-3">
          <BobLogo />
          <div>
            <div className="text-xl font-semibold text-white">
              bobai
            </div>
            <div className="text-sm text-white/45">
              alpha
            </div>
          </div>
        </div>

        <button
          onClick={onNewChat}
          className="mt-5 flex w-full items-center gap-2 rounded-xl border border-white/10 bg-[#121212] px-3 py-2.5 text-sm text-white/90 transition hover:bg-[#181818]"
        >
          <span className="text-lg">+</span>
          <span>new chat</span>
        </button>

        <div className="mt-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search chats"
            className="w-full rounded-xl border border-white/10 bg-[#121212] px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            className="group relative mb-1 flex items-center rounded-xl transition hover:bg-white/5"
          >
            <button
              onClick={() => onSelect(conversation.id)}
              className={
                conversation.id === activeId
                  ? "flex-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-left text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]"
                  : "flex-1 rounded-xl px-3 py-2 text-left text-white/80 hover:text-white"
              }
            >
              {editingId === conversation.id ? (
                <input
                  value={editingTitle}
                  onChange={(e) =>
                    setEditingTitle(e.target.value)
                  }
                  onBlur={finishRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") finishRename();
                    if (e.key === "Escape") {
                      setEditingId(null);
                      setEditingTitle("");
                    }
                  }}
                  className="w-full rounded-md border border-white/10 bg-[#161616] px-2 py-1 text-sm text-white outline-none"
                />
              ) : (
                <div className="flex items-center gap-2">
                  {conversation.pinned && (
                    <span className="text-xs text-[#d4a62a]">
                      📌
                    </span>
                  )}
                  <span className="truncate text-sm font-medium">
                    {conversation.title}
                  </span>
                </div>
              )}
            </button>

            <button
              onClick={() =>
                setMenuId(
                  menuId === conversation.id
                    ? null
                    : conversation.id
                )
              }
              className="mr-2 rounded-lg p-1 text-white/45 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
            >
              ⋯
            </button>

            {menuId === conversation.id && (
              <div className="absolute right-2 top-11 z-20 w-44 rounded-xl border border-white/10 bg-[#121212] py-1 shadow-2xl">
                <button
                  onClick={() => {
                    onTogglePin(conversation.id);
                    setMenuId(null);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5"
                >
                  {conversation.pinned ? "unpin" : "pin"}
                </button>

                <button
                  onClick={() => {
                    setEditingId(conversation.id);
                    setEditingTitle(conversation.title);
                    setMenuId(null);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5"
                >
                  rename
                </button>

                <button
                  onClick={() => {
                    onDelete(conversation.id);
                    setMenuId(null);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-white/5"
                >
                  delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/settings")}
            className="flex flex-1 items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
              B
            </div>

            <div className="min-w-0 text-left">
              <div className="truncate text-sm font-medium text-white">
                bob
              </div>
              <div className="truncate text-xs text-white/45">
                8th class • building bobai
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push("/settings")}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[#121212] text-white/70 transition hover:bg-[#181818] hover:text-white"
          >
            ⚙
          </button>
        </div>
      </div>
    </aside>
  );
}