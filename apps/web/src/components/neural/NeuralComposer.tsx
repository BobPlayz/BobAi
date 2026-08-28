"use client";

import { ArrowUp, Paperclip } from "lucide-react";

type Props = {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onFiles: (files: FileList | null) => void;
  disabled?: boolean;
};

export default function NeuralComposer({
  input,
  setInput,
  onSend,
  onFiles,
  disabled,
}: Props) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && input.trim()) onSend();
    }
  }

  return (
    <div className="mx-auto w-full max-w-[860px]">
      <div className="relative overflow-hidden rounded-[24px] border border-cyan-400/10 bg-[#080D13]/95 shadow-[0_16px_55px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="message bob ai"
          rows={2}
          disabled={disabled}
          className="block min-h-[76px] w-full resize-none bg-transparent px-5 pt-4 text-[15px] leading-7 text-white outline-none placeholder:text-white/25 disabled:opacity-50"
        />

        <div className="flex items-center justify-between px-4 pb-3">
          <label className="flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-xs font-medium text-white/45 transition hover:border-cyan-300/20 hover:text-cyan-100">
            <Paperclip className="h-3.5 w-3.5" />
            attach
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
          </label>

          <button
            type="button"
            onClick={onSend}
            disabled={disabled || !input.trim()}
            aria-label="send message"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-100 shadow-[0_0_20px_rgba(0,217,255,0.12)] transition hover:border-cyan-200/40 hover:bg-cyan-300/[0.12] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
