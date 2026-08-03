"use client";

export default function ChatInput({
  value,
  onChange,
  onSend,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="border-t border-white/10 px-6 py-5">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-[#111111] px-5 py-4">
          <button className="text-white/35 hover:text-white text-lg leading-none">
            +
          </button>

          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSend();
            }}
            className="flex-1 bg-transparent text-white outline-none placeholder:text-white/35"
            placeholder="message bobai..."
          />

          <button
            onClick={onSend}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200 transition"
          >
            send
          </button>
        </div>
      </div>
    </div>
  );
}