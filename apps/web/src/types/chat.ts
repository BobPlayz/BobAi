export type ChatImage = {
  id: string;
  url: string;
  prompt: string;
  /** Server-side image record used to restore generated images after a reload. */
  serverImageId?: string;
};

export type ChatFile = {
  id: string;
  name: string;
  type: string;
  text: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: ChatImage[];
  files?: ChatFile[];
  pinned?: boolean;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  pinned: boolean;
  messages: ChatMessage[];
};