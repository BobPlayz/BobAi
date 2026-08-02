import type { ChatMessage } from "@/types/chat";

export default function MessageBubble({
  message,
}: {
  message: ChatMessage;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-3xl px-5 py-4 ${
          isUser
            ? "bg-white text-black"
            : "border border-white/10 bg-white/5 text-white"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}