import { useRef, useState } from "react";
import type { ChatMessage } from "@/types/chat";
import { streamMessage } from "@/lib/stream";

export function useStream() {
  const [streaming, setStreaming] = useState(false);
  const currentReply = useRef("");

  async function start(
    messages: ChatMessage[],
    personality: string,
    handlers: {
      onStart: () => void;
      onToken: (text: string) => void;
      onDone: (reply: string) => void;
      onError: (message: string) => void;
    }
  ) {
    if (streaming) return;

    setStreaming(true);
    currentReply.current = "";

    handlers.onStart();

    try {
      await streamMessage(messages, personality, {
        onToken(token) {
          currentReply.current += token;
          handlers.onToken(currentReply.current);
        },
        onDone(reply) {
          handlers.onDone(reply);
          setStreaming(false);
        },
        onError(message) {
          handlers.onError(message);
          setStreaming(false);
        },
      });
    } catch (error) {
      handlers.onError(
        error instanceof Error
          ? error.message
          : "stream failed"
      );
      setStreaming(false);
    }
  }

  return {
    streaming,
    start,
  };
}