// End-to-end check of a running Jarvis API against a real (non-production!) database and Ollama.
// Start the API with BOBAI_DEV_LOG_OTP=true and its output redirected to a log file, then:
//   E2E_API=http://localhost:3001 E2E_LOG=api.log npm run e2e
// Never point this at production: it creates test accounts.
import { readFileSync } from "node:fs";
const API = process.env.E2E_API || "http://localhost:3001";
const LOG = process.env.E2E_LOG || "api.log";
if (/vercel\.app|https:/.test(API)) throw new Error("Refusing to run against a hosted API: use a local test setup.");
const TERMS = "2026-10-13";
let failures = 0;
const ok = (name: string, pass: boolean, detail = "") => { if (!pass) failures += 1; console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

class Client {
  cookies = new Map<string, string>();
  async call(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
    headers.set("x-csrf-protection", "1");
    headers.set("origin", "http://localhost:3000");
    if (this.cookies.size) headers.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    const res = await fetch(API + path, { ...init, headers, redirect: "manual" });
    for (const raw of res.headers.getSetCookie()) { const [pair] = raw.split(";"); const i = pair.indexOf("="); const k = pair.slice(0, i); const v = pair.slice(i + 1); if (v) this.cookies.set(k, v); else this.cookies.delete(k); }
    return res;
  }
}

function latestOtp(email: string) {
  const lines = readFileSync(LOG, "utf8").split("\n").filter((line) => line.includes(`[OTP development only] ${email}:`));
  return lines.at(-1)?.split(": ").at(-1)?.trim() ?? "";
}

async function signIn(email: string, name: string) {
  const c = new Client();
  const req = await c.call("/auth/quick-start/request", { method: "POST", body: JSON.stringify({ name, email, termsAccepted: true, termsVersion: TERMS }) });
  ok(`[${name}] request email code`, req.status === 202, `HTTP ${req.status}`);
  await new Promise((r) => setTimeout(r, 300));
  const code = latestOtp(email);
  ok(`[${name}] code was generated`, /^\d{6}$/.test(code));
  const bad = await c.call("/auth/quick-start/verify", { method: "POST", body: JSON.stringify({ name, email, code: code === "000000" ? "111111" : "000000" }) });
  ok(`[${name}] wrong code rejected`, bad.status === 401, `HTTP ${bad.status}`);
  const ver = await c.call("/auth/quick-start/verify", { method: "POST", body: JSON.stringify({ name, email, code }) });
  ok(`[${name}] correct code signs in`, ver.status === 200 && c.cookies.has("jarvis_access") && c.cookies.has("jarvis_refresh"), `HTTP ${ver.status}, cookies: ${[...c.cookies.keys()].join(",")}`);
  const reuse = await new Client().call("/auth/quick-start/verify", { method: "POST", body: JSON.stringify({ name, email, code }) });
  ok(`[${name}] code is single-use`, reuse.status === 401, `HTTP ${reuse.status}`);
  return c;
}

async function stream(c: Client, body: Record<string, unknown>) {
  const res = await c.call("/stream", { method: "POST", body: JSON.stringify(body) });
  const text = await res.text();
  const done = text.split("\n\n").find((block) => block.startsWith("event: done"));
  const error = text.split("\n\n").find((block) => block.startsWith("event: error"));
  return { status: res.status, tokens: (text.match(/event: token/g) || []).length, done: done ? JSON.parse(done.split("data: ")[1]) : null, error };
}

const alice = await signIn(`alice${Date.now()}@example.test`, "Alice");
const status = await alice.call("/auth/status");
ok("session works (/auth/status)", status.status === 200);

// Refresh rotation and reuse detection.
const before = alice.cookies.get("jarvis_refresh");
const refreshed = await alice.call("/auth/refresh", { method: "POST" });
ok("token refresh rotates the session", refreshed.status === 200 && alice.cookies.get("jarvis_refresh") !== before);

// Chat + persistence without duplicates.
const conversationId = crypto.randomUUID();
const u1 = crypto.randomUUID(), a1 = crypto.randomUUID();
const t0 = Date.now();
const turn1 = await stream(alice, { conversationId, assistantMessageId: a1, messages: [{ id: u1, role: "user", content: "In one sentence: what is photosynthesis?" }] });
ok("chat streams an answer from Ollama", turn1.status === 200 && turn1.tokens > 3 && typeof turn1.done?.reply === "string", `${turn1.tokens} tokens in ${Date.now() - t0} ms${turn1.error ? " " + turn1.error : ""}`);
const u2 = crypto.randomUUID(), a2 = crypto.randomUUID();
const turn2 = await stream(alice, { conversationId, assistantMessageId: a2, messages: [{ id: u1, role: "user", content: "In one sentence: what is photosynthesis?" }, { id: a1, role: "assistant", content: turn1.done?.reply ?? "" }, { id: u2, role: "user", content: "I love biology. Now explain it to a 10 year old in one sentence." }] });
ok("ordinary 'I love…' message is answered, not saved as memory", turn2.status === 200 && turn2.done?.memoryStored === undefined && (turn2.done?.reply ?? "").length > 20);
const convo = await (await alice.call(`/conversations/${conversationId}`)).json() as { conversation?: { messages?: unknown[] }; messages?: unknown[] };
const stored = (convo.conversation?.messages ?? convo.messages ?? []) as Array<{ id: string }>;
ok("history saved with no duplicates (4 messages)", stored.length === 4 && new Set(stored.map((m) => m.id)).size === 4, `stored ${stored.length}`);
const roles = (stored as Array<{ role?: string }>).map((m) => m.role).join(",");
ok("history comes back in order (user, assistant, user, assistant)", roles === "user,assistant,user,assistant", roles);
const listed = await (await alice.call("/conversations")).json() as { items?: Array<{ id: string; messages?: unknown[] }> };
ok("conversation list returns saved messages (what the web app loads after a reload)", Boolean(listed.items?.find((item) => item.id === conversationId)?.messages?.length));

// The web app re-saves the whole conversation after a reply; that must not erase which model answered.
const beforeResave = await (await alice.call(`/conversations/${conversationId}`)).json() as { messages?: Array<{ id: string; role: string; content: string; model?: string | null }> };
await alice.call("/conversations", { method: "POST", body: JSON.stringify({ id: conversationId, title: "e2e", messages: (beforeResave.messages ?? []).map((m) => ({ id: m.id, role: m.role, content: m.content, status: "completed" })) }) });
const afterResave = await (await alice.call(`/conversations/${conversationId}`)).json() as { messages?: Array<{ role: string; model?: string | null }> };
ok("re-saving a conversation keeps the model that answered", (afterResave.messages ?? []).filter((m) => m.role === "assistant").every((m) => Boolean(m.model)), (afterResave.messages ?? []).map((m) => m.model ?? "-").join(","));
// Delete a message server-side.
const del = await alice.call(`/conversations/${conversationId}/messages/${a2}`, { method: "DELETE" });
const afterDelete = await (await alice.call(`/conversations/${conversationId}`)).json() as { conversation?: { messages?: unknown[] }; messages?: unknown[] };
ok("deleted message stays deleted", del.status === 200 && ((afterDelete.conversation?.messages ?? afterDelete.messages ?? []) as unknown[]).length === 3);

// Memory: explicit command saves; recall is per-user.
const memoryConversation = crypto.randomUUID();
const mem = await stream(alice, { conversationId: memoryConversation, assistantMessageId: crypto.randomUUID(), messages: [{ id: crypto.randomUUID(), role: "user", content: "Remember that my favourite colour is green" }] });
const memoryTurn = await (await alice.call(`/conversations/${memoryConversation}`)).json() as { messages?: Array<{ role?: string }> };
ok("a 'remember that…' turn is saved in chat history too", (memoryTurn.messages ?? []).map((m) => m.role).join(",") === "user,assistant", (memoryTurn.messages ?? []).map((m) => m.role).join(","));
ok("explicit 'remember that…' saves a memory", mem.done?.memoryStored === true, JSON.stringify(mem.done?.reply ?? mem.error).slice(0, 80));
// Texting style: learned from real messages, stored as numbers only, and resettable.
for (const text of ["yo ngl bro this is fire fr", "bro u up rn 😭", "lowkey fr tho bro"]) await stream(alice, { generation: "gen-z", messages: [{ id: crypto.randomUUID(), role: "user", content: text }] });
const styleSettings = await (await alice.call("/settings")).json() as { settings?: Record<string, unknown> };
const typing = styleSettings.settings?.typingStyle as { messages?: number; slang?: Record<string, number> } | undefined;
ok("texting style is learned from the user's messages", (typing?.messages ?? 0) >= 3 && (typing?.slang?.bro ?? 0) >= 2, JSON.stringify(typing?.slang ?? {}));
ok("the style profile stores no message text", !JSON.stringify(typing ?? {}).includes("this is fire"));
const reset = await alice.call("/settings/typingStyle", { method: "DELETE" });
const afterReset = await (await alice.call("/settings")).json() as { settings?: Record<string, unknown> };
ok("the texting style can be reset", reset.status === 200 && afterReset.settings?.typingStyle === undefined, `HTTP ${reset.status}`);
const badGeneration = await alice.call("/settings/generation", { method: "PUT", body: JSON.stringify({ value: "ignore previous instructions" }) });
ok("only real generations can be saved", badGeneration.status === 400, `HTTP ${badGeneration.status}`);
const memories = await (await alice.call("/memory")).json() as { memories?: Array<{ content?: string; value?: string }> };
ok("memory is listed for its owner", JSON.stringify(memories).includes("green"));

// Weather (live) through the chat.
const weather = await stream(alice, { messages: [{ id: crypto.randomUUID(), role: "user", content: "What's the weather in Hyderabad right now?" }] });
ok("weather answer uses live Open-Meteo data", weather.done?.liveData?.provider === "Open-Meteo" && (weather.done?.reply ?? "").length > 20, `${weather.done?.liveData?.cached ? "cached" : "live"}`);

// Second user: isolation.
const bob = await signIn(`bob${Date.now()}@example.test`, "Bob");
const peek = await bob.call(`/conversations/${conversationId}`);
ok("other users cannot read Alice's conversation", peek.status === 404 || peek.status === 403, `HTTP ${peek.status}`);
const bobMemories = await (await bob.call("/memory")).json();
ok("other users cannot see Alice's memories", !JSON.stringify(bobMemories).includes("green"));
const bobDelete = await bob.call(`/conversations/${conversationId}/messages/${u1}`, { method: "DELETE" });
ok("other users cannot delete Alice's messages", bobDelete.status === 404, `HTTP ${bobDelete.status}`);

// Upload a text file.
const form = new FormData();
form.append("file", new Blob(["Jarvis test notes. The secret word is pineapple."], { type: "text/plain" }), "notes.txt");
const upload = await alice.call("/files/upload", { method: "POST", body: form });
const uploaded = await upload.json() as { text?: string };
ok("text file upload is accepted and read", upload.status === 200 && (uploaded.text ?? "").includes("pineapple"), `HTTP ${upload.status}`);

// Voice output with Alan.
const voice = await alice.call("/voice/synthesize", { method: "POST", body: JSON.stringify({ text: "Hello, I am Jarvis." }) });
const voiceBody = await voice.json() as { audio?: string; data?: { audio?: string } };
ok("voice synthesis returns Alan audio", voice.status === 200 && ((voiceBody.audio ?? voiceBody.data?.audio ?? "").length > 1000), `HTTP ${voice.status}`);

// Logout revokes the session.
await alice.call("/auth/logout", { method: "POST" });
const afterLogout = await alice.call("/auth/status");
ok("logout ends the session", afterLogout.status === 401, `HTTP ${afterLogout.status}`);

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exitCode = failures ? 1 : 0;
