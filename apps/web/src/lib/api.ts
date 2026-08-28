import type { ChatMessage } from "@/types/chat";
import { clearSession, getSession, refreshSession, setSession } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function request(path: string, init: RequestInit = {}, retry = true) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const session = getSession();
  if (session?.accessToken) headers.set("Authorization", `Bearer ${session.accessToken}`);

  let res = await fetch(`${API}${path}`, { ...init, headers });
  if (res.status === 401 && retry && session?.refreshToken) {
    const refreshed = await refreshSession();
    if (refreshed?.accessToken) {
      const retryHeaders = new Headers(init.headers);
      retryHeaders.set("Content-Type", "application/json");
      retryHeaders.set("Authorization", `Bearer ${refreshed.accessToken}`);
      res = await fetch(`${API}${path}`, { ...init, headers: retryHeaders });
    } else {
      clearSession();
    }
  }
  return res;
}

export async function sendMessage(messages: ChatMessage[], personality = "", modelId?: string) {
  const cleanMessages = messages.map((m) => ({ role: m.role, content: m.content }));
  const res = await request("/chat", {
    method: "POST",
    body: JSON.stringify({ messages: cleanMessages, personality, ...(modelId ? { modelId } : {}) }),
  });
  if (!res.ok) throw new Error((await res.text()) || "Failed to send message");
  return res.json();
}

export async function generateImage(prompt: string) {
  const res = await request("/images/generate", {
    method: "POST",
    body: JSON.stringify({ prompt, count: 4, width: 1024, height: 1024 }),
  });
  if (!res.ok) throw new Error((await res.text()) || "Failed to generate image");
  return res.json();
}

export async function uploadFile(file: File, onProgress?: (progress: number) => void) {
  const form = new FormData();
  form.append("file", file);
  const session = getSession();

  return new Promise<{ name: string; type: string; text: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/files/upload`);
    if (session?.accessToken) xhr.setRequestHeader("Authorization", `Bearer ${session.accessToken}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error("Invalid upload response")); }
      } else reject(new Error(xhr.responseText || "Upload failed"));
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(form);
  });
}

export async function runCodingAgent(task: string) {
  const res = await request("/agents/run", {
    method: "POST",
    body: JSON.stringify({ task }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Coding agent failed");
  return result as { output: string; warnings: string };
}
