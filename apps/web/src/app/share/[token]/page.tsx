"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import JarvisMark from "@/components/JarvisMark";
import Markdown from "@/components/Markdown";
import { API } from "@/lib/auth";

type Shared = { title: string; sharedAt: string; messages: Array<{ role: "user" | "assistant"; content: string }> };

/** A read-only chat someone shared: a snapshot of the chat as it was when the link was made. */
export default function SharedChatPage() {
  const { token } = useParams<{ token: string }>();
  const [chat, setChat] = useState<Shared | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/shared/${encodeURIComponent(token)}`)
      .then(async (res) => { const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.error || "This share link doesn't work anymore."); return data as Shared; })
      .then((data) => { if (!cancelled) setChat(data); })
      .catch((problem: unknown) => { if (!cancelled) setError(problem instanceof Error ? problem.message : "This share link doesn't work anymore."); });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <main id="main" tabIndex={-1} className="relative z-[1] min-h-screen bg-[var(--bg)] px-5 pb-24 pt-6 text-[var(--text)] sm:px-8">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <Link href="/" className="atelier-wordmark"><JarvisMark />Jarvis</Link>
        <Link href="/login" className="btn-ink !min-h-10 text-sm">Try Jarvis <span className="btn-arrow" aria-hidden>→</span></Link>
      </header>
      <div className="mx-auto mt-10 max-w-3xl">
        {error ? (
          <div className="py-20 text-center">
            <h1 className="font-display text-5xl">Link not found<em className="text-[var(--accent)]">.</em></h1>
            <p className="mt-4 text-[var(--muted)]">{error} The person who shared it may have stopped sharing.</p>
          </div>
        ) : !chat ? (
          <p className="py-20 text-center text-[var(--muted)]" role="status">Loading the chat…</p>
        ) : (
          <>
            <p className="caption">Shared chat · read-only · {new Date(chat.sharedAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</p>
            <h1 className="font-display mt-3 text-4xl leading-tight sm:text-5xl">{chat.title}</h1>
            <div className="mt-10 space-y-8">
              {chat.messages.map((message, index) => message.role === "user" ? (
                <div key={index} className="flex justify-end"><p className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-md bg-[var(--surface-2)] px-5 py-3 leading-7">{message.content}</p></div>
              ) : (
                <div key={index}><p className="caption mb-2 flex items-center gap-2"><JarvisMark />Jarvis</p><Markdown text={message.content} /></div>
              ))}
            </div>
            <div className="mt-16 border-t border-[var(--hairline)] pt-8 text-center">
              <p className="text-[var(--muted)]">Want your own Jarvis? It&apos;s free, no email needed to try.</p>
              <Link href="/login" className="btn-ink mt-4">Start chatting <span className="btn-arrow" aria-hidden>→</span></Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
