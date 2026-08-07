"use client";

export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 text-white/45">
      <div className="flex gap-1">
        <span className="h-2 w-2 animate-bounce rounded-full bg-white/45 [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-white/45 [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-white/45" />
      </div>
      <span>bobai is thinking</span>
    </div>
  );
}