"use client";

import { ArrowUp, Paperclip } from "lucide-react";
import VoiceButton from "@/components/VoiceButton";
import { useTheme } from "./ThemeProvider";

type Props = {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onFiles: (files: FileList | null) => void;
  disabled?: boolean;
};

export default function NeuralComposer({ input, setInput, onSend, onFiles, disabled }: Props) {
  const { theme } = useTheme();
  const light = theme === "light";

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!disabled && input.trim()) onSend();
    }
  }

  return (
    <div className="mx-auto w-full max-w-[860px]">
      <div className={`relative rounded-2xl border shadow-sm ${light ? "border-[#d1d5db] bg-white" : "border-white/10 bg-[#111214]"}`}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Bob AI"
          aria-label="Message Bob AI"
          rows={2}
          disabled={disabled}
          className={`block min-h-[76px] w-full resize-none rounded-t-2xl bg-transparent px-4 pt-4 text-[15px] leading-7 outline-none placeholder:opacity-50 disabled:opacity-50 ${light ? "text-[#202123] placeholder:text-[#6b7280]" : "text-white placeholder:text-white/45"}`}
        />
        <div className={`flex items-center justify-between gap-3 px-3 pb-3 ${light ? "text-[#4b5563]" : "text-white/70"}`}>
          <div className="flex items-center gap-2">
            <label className={`flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs font-medium transition ${light ? "border-[#e5e7eb] bg-[#f9fafb] hover:bg-[#f3f4f6]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"}`}>
              <Paperclip className="h-3.5 w-3.5" />
              Attach
              <input type="file" multiple className="sr-only" onChange={(event) => { onFiles(event.target.files); event.currentTarget.value = ""; }} />
            </label>
            <VoiceButton onTranscript={(text) => setInput(text)} disabled={disabled} />
          </div>
          <button type="button" onClick={onSend} disabled={disabled || !input.trim()} aria-label="Send message" title="Send message" className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-35">
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p className={`mt-2 text-center text-[11px] ${light ? "text-[#6b7280]" : "text-white/35"}`}>Enter to send · Shift + Enter for a new line</p>
    </div>
  );
}
