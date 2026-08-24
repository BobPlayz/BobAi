import type { ChatMessage } from "@/types/chat";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function sendMessage(
  messages: ChatMessage[],
  personality = ""
) {
  const cleanMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const res = await fetch(`${API}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: cleanMessages,
      personality,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to send message");
  }

  return res.json();
}

export async function generateImage(prompt: string) {
  const res = await fetch(`${API}/images`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      count: 4,
      width: 1024,
      height: 1024,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to generate image");
  }

  return res.json();
}

export async function uploadFile(
  file: File,
  onProgress?: (progress: number) => void
) {
  const form = new FormData();
  form.append("file", file);

  return new Promise<{
    name: string;
    type: string;
    text: string;
  }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", `${API}/files/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(xhr.responseText || "Upload failed"));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Upload failed"));
    };

    xhr.send(form);
  });
}

export async function runCodingAgent(task: string) {
  const res = await fetch(`${API}/agents/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task }),
  });

  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Coding agent failed");
  return result as { output: string; warnings: string };
}