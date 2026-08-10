"use client";

import { useRef } from "react";
import {
  Search,
  Brain,
  Image as ImageIcon,
  Code2,
  Paperclip,
  Mic,
  Send,
} from "lucide-react";

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
  const fileRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="relative">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[radial-gradient(circle_at_top,rgba(0,217,255,0.14),transparent_70%)] blur-2xl" />

      <div className="relative rounded-[28px] border border-cyan-400/14 bg-[#070C12]/95 p-4 shadow-[0_0_36px_rgba(0,217,255,0.12)] backdrop-blur-2xl">
        {/* top tool row */}
        <div className="mb-3 flex items-center gap-2">
          <ToolButton icon={Search} label="Search" active />
          <ToolButton icon={Brain} label="Reason" />
          <ToolButton icon={ImageIcon} label="Image" />
          <ToolButton icon={Code2} label="Code" />
        </div>

        {/* input area */}
        <div className="relative overflow-hidden rounded-[22px] border border-cyan-400/12 bg-[#050A10]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,217,255,0.06),transparent_55%)]" />

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Bob AI anything..."
            disabled={disabled}
            rows={4}
            className="relative w-full resize-none bg-transparent px-5 py-4 text-[15px] leading-7 text-white placeholder:text-cyan-300/25 outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!disabled && input.trim()) onSend();
              }
            }}
          />

          {/* bottom controls */}
          <div className="relative flex items-center justify-between border-t border-cyan-400/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex h-10 items-center gap-2 rounded-xl border border-cyan-400/10 bg-[#081018] px-3 text-sm text-cyan-100 transition hover:border-cyan-300/25 hover:bg-[#0A1622]"
              >
                <Paperclip className="h-4 w-4 text-cyan-300" />
                Attach
              </button>

              <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/10 bg-[#081018] text-cyan-300 transition hover:border-cyan-300/25 hover:bg-[#0A1622]">
                <Mic className="h-4 w-4" />
              </button>
            </div>

            {/* send core */}
            <button
              onClick={onSend}
              disabled={disabled || !input.trim()}
              className="group relative flex h-12 w-12 items-center justify-center rounded-full border border-cyan-300/30 bg-[#0A1622] text-cyan-100 shadow-[0_0_26px_rgba(0,217,255,0.28)] transition hover:scale-[1.03] hover:shadow-[0_0_38px_rgba(0,217,255,0.46)] disabled:opacity-50 disabled:hover:scale-100"
            >
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,#4DEBFF_0%,#00D9FF_45%,#0A1622_100%)] opacity-80 blur-[2px] transition group-hover:opacity-100" />
              <Send className="relative h-5 w-5" />
            </button>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  active = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={
        active
          ? "flex h-10 items-center gap-2 rounded-xl border border-cyan-300/28 bg-[#0A1622] px-3 text-sm font-medium text-cyan-100 shadow-[0_0_18px_rgba(0,217,255,0.16)]"
          : "flex h-10 items-center gap-2 rounded-xl border border-cyan-400/10 bg-[#081018] px-3 text-sm text-cyan-300/80 transition hover:border-cyan-300/20 hover:bg-[#0A1622]"
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}