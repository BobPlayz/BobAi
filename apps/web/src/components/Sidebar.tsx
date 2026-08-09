"use client";

import { useState } from "react";
import type { Conversation } from "@/types/chat";

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

export default function Sidebar({
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  return (
    <aside className="flex w-64 flex-col border-r border-[#232B36] bg-[#0F141A]">
      <div className="border-b border-[#232B36] p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#171D26]">
            <span className="text-sm font-black text-[#38BDF8]">B</span>
          </div>

          <div className="leading-tight">
            <div className="text-base font-semibold text-[#E5EEF7]">
              Bob AI
            </div>

            <div className="text-xs text-[#94A3B8]">
              Personal AI workspace
            </div>
          </div>
        </div>

        <button
          onClick={onNewChat}
          className="w-full rounded-xl bg-[#38BDF8] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-[#0EA5E9]"
        >
          + New Chat
        </button>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations"
          className="mt-3 w-full rounded-xl border border-[#232B36] bg-[#141A22] px-3 py-2 text-sm text-[#E5EEF7] outline-none placeholder:text-[#64748B] focus:border-[#38BDF8]"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {conversations.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center">
            <div>
              <div className="text-sm font-medium text-[#E5EEF7]">
                No conversations found
              </div>

              <div className="mt-1 text-xs text-[#94A3B8]">
                Try another search or start a new chat.
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {conversations.map((conversation) => {
              const active = conversation.id === activeId;

              return (
                <div
                  key={conversation.id}
                  className={
                    active
                      ? "rounded-xl border border-[#38BDF8]/30 bg-[#171D26]"
                      : "rounded-xl border border-transparent hover:border-[#232B36] hover:bg-[#141A22]"
                  }
                >
                  <div
                    className="cursor-pointer p-3"
                    onClick={() => onSelect(conversation.id)}
                  >
                    {editingId === conversation.id ? (
                      <input
                        autoFocus
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={() => {
                          onRename(conversation.id, title);
                          setEditingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            onRename(conversation.id, title);
                            setEditingId(null);
                          }
                        }}
                        className="w-full bg-transparent text-sm font-medium text-[#E5EEF7] outline-none"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div
                          className={
                            active
                              ? "h-2 w-2 rounded-full bg-[#38BDF8]"
                              : "h-2 w-2 rounded-full bg-[#64748B]"
                          }
                        />

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-[#E5EEF7]">
                            {conversation.title}
                          </div>

                          <div className="text-[11px] text-[#64748B]">
                            {new Date(
                              conversation.createdAt
                            ).toLocaleDateString()}
                          </div>
                        </div>

                        {conversation.pinned && (
                          <span className="text-xs text-[#38BDF8]">
                            📌
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 px-3 pb-3">
                    <button
                      onClick={() => onPin(conversation.id)}
                      className="rounded-lg px-2 py-1 text-[11px] text-[#94A3B8] transition hover:bg-[#171D26] hover:text-[#38BDF8]"
                    >
                      {conversation.pinned ? "Unpin" : "Pin"}
                    </button>

                    <button
                      onClick={() => {
                        setEditingId(conversation.id);
                        setTitle(conversation.title);
                      }}
                      className="rounded-lg px-2 py-1 text-[11px] text-[#94A3B8] transition hover:bg-[#171D26] hover:text-[#38BDF8]"
                    >
                      Rename
                    </button>

                    <button
                      onClick={() => onDelete(conversation.id)}
                      className="rounded-lg px-2 py-1 text-[11px] text-[#94A3B8] transition hover:bg-[#171D26] hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-[#232B36] p-4">
        <div className="flex items-center gap-3 rounded-xl bg-[#141A22] px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0B0F14] text-sm font-semibold text-[#E5EEF7]">
            B
          </div>

          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-[#E5EEF7]">
              Bob
            </div>

            <div className="text-xs text-[#94A3B8]">
              Local profile
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}