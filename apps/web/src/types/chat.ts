export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pinned?: boolean;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  pinned: boolean;
  messages: ChatMessage[];
};