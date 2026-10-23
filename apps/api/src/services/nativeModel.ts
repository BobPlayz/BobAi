/** Chat message shape shared by the chat engine, model router and Ollama provider. */
export type NativeMessage = { role: "system" | "user" | "assistant"; content: string };
