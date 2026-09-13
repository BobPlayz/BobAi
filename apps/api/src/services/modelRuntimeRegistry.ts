export type RuntimeCapability = "chat" | "coding" | "vision";
export type RuntimeState = "cold" | "ready" | "busy" | "error";
export type RuntimeModel = { id: string; capability: RuntimeCapability; priority: number; memoryMb: number; runnable: boolean };
export const RUNTIME_MODELS: RuntimeModel[] = [
  { id: "bob", capability: "chat", priority: 100, memoryMb: 512, runnable: true },
  { id: "coder", capability: "coding", priority: 90, memoryMb: 512, runnable: true },
  { id: "bob-vision-0.1", capability: "vision", priority: 70, memoryMb: 768, runnable: false },
];
