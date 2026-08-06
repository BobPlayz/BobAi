export type MessageRole = "user" | "assistant";

export interface ChatImage {
  id: string;
  url: string;
  prompt: string;
  width?: number;
  height?: number;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  pinned?: boolean;
  images?: ChatImage[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  pinned: boolean;
  messages: ChatMessage[];
}