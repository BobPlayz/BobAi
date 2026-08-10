"use client";

import { ArrowUp, Image, Mic, Paperclip, Sparkles } from "lucide-react";

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
    <div className="mx-auto w-full max-w-[980px]">
      <div className="relative overflow-hidden rounded-[30px] border border-cyan-400/12 bg-[#070C12]/96 shadow-[0_0_0_1px_rgba(0,217,255,0.05),0_22px_70px_rgba(0,0,0,0.5)] backdrop-blur-3xl">
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent" />

        <div className="px-5 pt-5 pb-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Bob AI"
            rows={3}
            disabled={disabled}
            className="w-full resize-none bg-transparent text-[15px] leading-7 text-white placeholder:text-cyan-300/22 outline-none disabled:opacity-50"
          />

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-cyan-400/10 bg-[#081018] text-cyan-300/72 transition hover:border-cyan-300/22 hover:text-cyan-100">
                <Paperclip className="h-4 w-4" />
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => onFiles(e.target.files)}
                />
              </label>

              <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/10 bg-[#081018] text-cyan-300/72 transition hover:border-cyan-300/22 hover:text-cyan-100">
                <Image className="h-4 w-4" />
              </button>

              <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/10 bg-[#081018] text-cyan-300/72 transition hover:border-cyan-300/22 hover:text-cyan-100">
                <Mic className="h-4 w-4" />
              </button>

              <button className="flex h-11 items-center gap-2 rounded-2xl border border-cyan-400/10 bg-[#081018] px-4 text-sm text-cyan-100/90 transition hover:border-cyan-300/22 hover:text-cyan-100">
                <Sparkles className="h-4 w-4" />
                Think
              </button>
            </div>

            <button
              onClick={onSend}
              disabled={disabled || !input.trim()}
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/22 bg-[#0A1622] text-cyan-100 shadow-[0_0_22px_rgba(0,217,255,0.2)] transition hover:border-cyan-200/45 hover:shadow-[0_0_34px_rgba(0,217,255,0.32)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}