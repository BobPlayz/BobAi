import fs from "fs";

export type MemoryEntry = {
  key: string;
  value: string;
};

const FILE = "memory.json";
const memory = new Map<string, string>();

try {
  const data = JSON.parse(fs.readFileSync(FILE, "utf8")) as MemoryEntry[];
  data.forEach((m) => memory.set(m.key.toLowerCase(), m.value));
} catch {}

function save() {
  const data = [...memory].map(([key, value]) => ({ key, value }));
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function remember(key: string, value: string) {
  memory.set(key.toLowerCase(), value);
  save();
}

export function recall(key: string) {
  return memory.get(key.toLowerCase()) || "";
}

export function recallAll() {
  return [...memory].map(([key, value]) => ({ key, value }));
}

export function clearMemory() {
  memory.clear();
  save();
}

export function memoryAsPrompt() {
  if (!memory.size) return "none";
  return [...memory]
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}