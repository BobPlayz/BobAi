"use client";

import { useRef, useState } from "react";

type Props = {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onFiles: (files: File[]) => void;
  disabled: boolean;
  uploadingFiles: string[];
  uploadProgress: Record<string, number>;
};

export default function ChatInput({
  input,
  setInput,
  onSend,
  onFiles,
  disabled,
  uploadingFiles,
  uploadProgress,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);

    const files = Array.from(e.dataTransfer.files);

    if (files.length > 0) {
      onFiles(files);
    }
  }

  return (
    <div className="border-t border-[#232B36] bg-[#10161D]">
      <div className="mx-auto max-w-3xl px-6 py-4">
        {uploadingFiles.length > 0 && (
          <div className="mb-3 rounded-xl border border-[#232B36] bg-[#141A22] p-3">
            <div className="space-y-2">
              {uploadingFiles.map((name) => {
                const progress = uploadProgress[name] || 0;

                return (
                  <div
                    key={name}
                    className="flex items-center gap-3 rounded-lg border border-[#232B36] bg-[#171D26] px-3 py-2"
                  >
                    <div className="relative h-8 w-8">
                      <svg
                        className="h-8 w-8 -rotate-90"
                        viewBox="0 0 40 40"
                      >
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          stroke="#2A3340"
                          strokeWidth="3"
                          fill="none"
                        />

                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          stroke="#38BDF8"
                          strokeWidth="3"
                          strokeLinecap="round"
                          fill="none"
                          strokeDasharray={100}
                          strokeDashoffset={100 - progress}
                        />
                      </svg>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-[#E5EEF7]">
                        {name}
                      </div>

                      <div className="text-xs text-[#94A3B8]">
                        Uploading... {progress}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`composer-shell ${disabled ? "" : "idle"} ${
            dragging
              ? "shadow-[0_0_20px_rgba(56,189,248,0.15)]"
              : ""
          }`}
        >
          <div
            className={
              dragging
                ? "rounded-[28px] border border-[#38BDF8] bg-[#141A22]"
                : "rounded-[28px] border border-[#232B36] bg-[#141A22]"
            }
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message Bob AI"
              rows={2}
              className="w-full resize-none bg-transparent px-5 py-5 text-[16px] leading-6 text-[#E5EEF7] outline-none placeholder:text-[#A7B6C7]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
            />

            <div className="flex items-center justify-between px-5 pb-5">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-9 items-center gap-2 rounded-lg border border-[#232B36] bg-[#171D26] px-3 text-sm font-medium text-[#E5EEF7] transition hover:border-[#38BDF8] hover:text-[#38BDF8]"
              >
                <span className="text-base">+</span>
                Upload
              </button> 
                            {disabled ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#171D26]">
                  <div className="thinking-triangle" />
                </div>
              ) : (
                <button
                  onClick={onSend}
                  disabled={!input.trim()}
                  className={
                    !input.trim()
                      ? "flex h-10 w-10 items-center justify-center rounded-full bg-[#1A212B] text-[#64748B]"
                      : "flex h-10 w-10 items-center justify-center rounded-full bg-[#38BDF8] text-black transition hover:scale-105 hover:bg-[#0EA5E9]"
                  }
                >
                  <span className="text-lg font-semibold">↑</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          hidden
          multiple
          accept=".pdf,.txt,.png,.jpg,.jpeg,.webp"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);

            if (files.length > 0) {
              onFiles(files);
            }

            e.currentTarget.value = "";
          }}
        />

        <div className="mt-2 text-center text-[11px] text-[#64748B]">
          Bob AI can make mistakes. Check important information.
        </div>
      </div>
    </div>
  );
}