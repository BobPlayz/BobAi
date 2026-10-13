"use client";

import { ArrowUp, Paperclip, Square, X } from "lucide-react";
import VoiceButton from "@/components/VoiceButton";
import { useTheme } from "./ThemeProvider";

type Props = {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onFiles: (files: FileList | null) => void;
  disabled?: boolean;
  streaming?: boolean;
  onStop?: () => void;
  uploadingFiles?: string[];
  uploadProgress?: Record<string, number>;
  onCancelUpload?: (key: string) => void;
};

export default function NeuralComposer({ input, setInput, onSend, onFiles, disabled, streaming, onStop, uploadingFiles = [], uploadProgress = {}, onCancelUpload }: Props) {
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
      {uploadingFiles.length > 0 && <div className={`mb-2 space-y-2 rounded-xl border p-2 ${light ? "border-[#e5e7eb] bg-white" : "border-white/10 bg-[#111214]"}`}>
        {uploadingFiles.map((key) => <div key={key} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-xs ${light ? "text-[#374151]" : "text-white/75"}`}>
          <span className="min-w-0 flex-1 truncate">{key.split(":").slice(0, -2).join(":") || key}</span>
          <span className="tabular-nums">{(uploadProgress[key] ?? 0) >= 100 ? "Processing…" : `${uploadProgress[key] || 0}%`}</span>
          <button type="button" onClick={() => onCancelUpload?.(key)} aria-label={`Cancel file task ${key}`} title="Cancel file task" className="rounded-md p-1 hover:bg-red-500/10 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
        </div>)}
      </div>}
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
            <label className={`flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs font-medium transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-sky-500 ${light ? "border-[#e5e7eb] bg-[#f9fafb] hover:bg-[#f3f4f6]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"}`}>
              <Paperclip className="h-3.5 w-3.5" />
              Attach
              <input type="file" multiple accept=".pdf,.txt,.md,.csv,.html,.css,.js,.xml,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={(event) => { onFiles(event.target.files); event.currentTarget.value = ""; }} />
            </label>
            <VoiceButton onTranscript={(text) => setInput(text)} disabled={disabled} />
          </div>
          {streaming ? (
            <button type="button" onClick={onStop} aria-label="Stop response" title="Stop response" className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500 text-white transition hover:bg-red-600">
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button type="button" onClick={onSend} disabled={disabled || !input.trim()} aria-label="Send message" title="Send message" className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-35">
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <p className={`mt-2 text-center text-[11px] ${light ? "text-[#6b7280]" : "text-white/35"}`}>Enter to send · Shift + Enter for a new line</p>
    </div>
  );
}
