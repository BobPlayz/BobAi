"use client";

import { ArrowUp, AudioLines, Paperclip, Square, Volume2, VolumeX, X } from "lucide-react";
import VoiceButton from "@/components/VoiceButton";

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
  voiceReplies?: boolean;
  onToggleVoiceReplies?: () => void;
  /** Opens hands-free talk mode. */
  onTalk?: () => void;
  /** Sends what voice typing produced, straight away (when "send automatically" is on). */
  onVoiceSend?: (text: string) => void;
};

export default function NeuralComposer({ input, setInput, onSend, onFiles, disabled, streaming, onStop, uploadingFiles = [], uploadProgress = {}, onCancelUpload, voiceReplies = false, onToggleVoiceReplies, onTalk, onVoiceSend }: Props) {

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!disabled && input.trim()) onSend();
    }
  }

  return (
    <div className="mx-auto w-full max-w-[820px]">
      {uploadingFiles.length > 0 && (
        <div className="mb-2 space-y-1 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-2">
          {uploadingFiles.map((key) => (
            <div key={key} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{key.split(":").slice(0, -2).join(":") || key}</span>
              <span className="caption tabular-nums">{(uploadProgress[key] ?? 0) >= 100 ? "Reading…" : `${uploadProgress[key] || 0}%`}</span>
              <button type="button" onClick={() => onCancelUpload?.(key)} aria-label={`Cancel ${key.split(":")[0]}`} className="atelier-iconbtn !h-7 !w-7"><X className="h-3.5 w-3.5" aria-hidden /></button>
            </div>
          ))}
        </div>
      )}
      <div className="atelier-composer">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Jarvis anything…"
          aria-label="Message Jarvis"
          rows={2}
          disabled={disabled}
        />
        <div className="flex items-center justify-between gap-3 px-2.5 pb-2.5">
          <div className="flex items-center gap-1">
            <label className="atelier-iconbtn cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-[var(--accent)]" title="Attach a file">
              <Paperclip className="h-4 w-4" aria-hidden />
              <span className="sr-only">Attach a file</span>
              <input type="file" multiple accept=".pdf,.txt,.md,.csv,.html,.css,.js,.xml,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={(event) => { onFiles(event.target.files); event.currentTarget.value = ""; }} />
            </label>
            <VoiceButton onTranscript={(text) => setInput(text)} disabled={disabled} currentText={input} onFinish={onVoiceSend} />
            {onTalk && (
              <button type="button" onClick={onTalk} disabled={disabled} aria-label="Talk to Jarvis (hands-free voice chat)" title="Talk mode" className="atelier-chip !min-h-9">
                <AudioLines className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Talk</span>
              </button>
            )}
            {onToggleVoiceReplies && (
              <button
                type="button"
                onClick={onToggleVoiceReplies}
                aria-pressed={voiceReplies}
                aria-label={voiceReplies ? "Turn off spoken replies" : "Turn on spoken replies"}
                title={voiceReplies ? "Spoken replies on" : "Spoken replies off"}
                className="atelier-chip !min-h-9"
              >
                {voiceReplies ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
                <span className="hidden sm:inline">Voice {voiceReplies ? "on" : "off"}</span>
              </button>
            )}
          </div>
          {streaming ? (
            <button type="button" onClick={onStop} aria-label="Stop response" title="Stop" className="atelier-send !bg-[var(--accent)] !text-[var(--accent-ink)]">
              <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
            </button>
          ) : (
            <button type="button" onClick={onSend} disabled={disabled || !input.trim()} aria-label="Send message" title="Send" className="atelier-send">
              <ArrowUp className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
      <p className="caption mt-2 text-center normal-case tracking-normal"><span className="hidden sm:inline">Enter to send · Shift + Enter for a new line · ? for shortcuts · </span>Jarvis can be wrong, so double-check important stuff.</p>
    </div>
  );
}
