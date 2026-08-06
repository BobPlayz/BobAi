"use client";

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
  return (
    <div className="border-t border-white/10 bg-black px-6 py-4">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[#111111] px-5 py-3 transition focus-within:border-white/20">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="message bobai"
            className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/35 outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSend();
              }
            }}
          />

          <button
            onClick={onSend}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition hover:opacity-90"
            aria-label="Send message"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}