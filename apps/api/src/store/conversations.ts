export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type StoredConversation = {
  id: string;
  title: string;
  updatedAt: number;
  messages: StoredMessage[];
};

const conversations = new Map<string, StoredConversation>();

export function getConversation(id: string) {
  return conversations.get(id);
}

export function saveConversation(
  conversation: StoredConversation
) {
  conversations.set(conversation.id, conversation);
}

export function listConversations() {
  return Array.from(conversations.values()).sort(
    (a, b) => b.updatedAt - a.updatedAt
  );
}

export function deleteConversation(id: string) {
  conversations.delete(id);
}