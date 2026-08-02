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
    <div className="border-t border-white/10 p-6">
      <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-4">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSend();
          }}
          className="flex-1 bg-transparent outline-none placeholder:text-white/40"
          placeholder="message bobai..."
        />

        <button
          onClick={onSend}
          className="rounded-full bg-white px-4 py-2 font-semibold text-black hover:bg-gray-200"
        >
          send
        </button>
      </div>
    </div>
  );
}