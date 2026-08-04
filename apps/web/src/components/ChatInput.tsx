"use client";

import { useRef } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
};

export default function ChatInput({
  value,
  onChange,
  onSend,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className="border-t border-white/10 bg-black px-6 py-4">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[#151515] px-4 py-2.5">
          <button className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white">
            +
          </button>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything"
            rows={1}
            className="max-h-32 min-h-[22px] flex-1 resize-none bg-transparent py-1 text-[15px] text-white placeholder:text-white/35 outline-none"
          />

          <button className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white">
            🎤
          </button>

          <button
            onClick={onSend}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d4a62a] text-black transition hover:brightness-110 active:scale-95"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}