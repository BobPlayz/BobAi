import MessageBubble from "./MessageBubble";
import type { ChatMessage } from "@/types/chat";

export default function ChatWindow({
  messages,
}: {
  messages: ChatMessage[];
}) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
    </div>
  );
}