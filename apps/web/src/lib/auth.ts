const ONBOARDING_KEY = "bobai_onboarding";
const PENDING_EMAIL_KEY = "bobai_pending_verification_email";
const PENDING_NAME_KEY = "bobai_pending_verification_name";
// The name typed at sign-in, kept until onboarding has used it.
const SIGNUP_NAME_KEY = "jarvis.signupName";
// Set while signed in as a guest (an account with no email), so log out can warn that guest chats are lost.
const GUEST_KEY = "jarvis.guest";
const LEGACY_SESSION_KEY = "bobai_session";
export const API = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "production" ? "/api" : "http://localhost:3001");
type ApiError = { error?: string };
export type Session = { accessToken: ""; expiresIn: number; email?: string; role?: string; username?: string };
export type LoginResult = { ok: true; mfaRequired?: false } | { ok: true; mfaRequired: true; challengeToken: string; expiresInSeconds: number } | { ok: false; error: string };
let session: Session | null = null;
async function readJson<T>(response: Response): Promise<T> { return (await response.json().catch(() => ({}))) as T; }
async function authenticate(path: string, body: Record<string, unknown>): Promise<LoginResult> { try { const res = await fetch(`${API}${path}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" }, body: JSON.stringify(body) }); const data = await readJson<{ expiresIn?: number; mfaRequired?: boolean; challengeToken?: string; expiresInSeconds?: number } & ApiError>(res); if (!res.ok) return { ok: false, error: data.error || "authentication failed" }; if (data.mfaRequired === true && typeof data.challengeToken === "string" && typeof data.expiresInSeconds === "number") return { ok: true, mfaRequired: true, challengeToken: data.challengeToken, expiresInSeconds: data.expiresInSeconds }; if (typeof data.expiresIn !== "number") return { ok: false, error: "invalid session from backend" }; session = { accessToken: "", expiresIn: data.expiresIn }; return { ok: true }; } catch { return { ok: false, error: "backend unavailable" }; } }
export async function requestQuickStart(name: string, email: string, termsAccepted: true, termsVersion: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API}/auth/quick-start/request`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" }, body: JSON.stringify({ name, email, termsAccepted, termsVersion }) });
    const data = await readJson<ApiError>(res);
    if (!res.ok) return { ok: false, error: data.error || "verification code could not be sent" };
    localStorage.setItem(PENDING_EMAIL_KEY, email.trim().toLowerCase());
    localStorage.setItem(PENDING_NAME_KEY, name.trim());
    return { ok: true };
  } catch { return { ok: false, error: "backend unavailable" }; }
}
export async function verifyQuickStart(name: string, email: string, code: string): Promise<{ ok: boolean; error?: string; mfaRequired?: boolean; challengeToken?: string }> {
  try {
    const res = await fetch(`${API}/auth/quick-start/verify`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" }, body: JSON.stringify({ name, email, code }) });
    const data = await readJson<{ expiresIn?: number; mfaRequired?: boolean; challengeToken?: string } & ApiError>(res);
    if (!res.ok) return { ok: false, error: data.error || "verification failed" };
    if (data.mfaRequired === true && typeof data.challengeToken === "string") { localStorage.removeItem(PENDING_EMAIL_KEY); localStorage.removeItem(PENDING_NAME_KEY); return { ok: true, mfaRequired: true, challengeToken: data.challengeToken }; }
    if (typeof data.expiresIn !== "number") return { ok: false, error: "invalid session from backend" };
    session = { accessToken: "", expiresIn: data.expiresIn, email: email.trim().toLowerCase() };
    if (name.trim()) localStorage.setItem(SIGNUP_NAME_KEY, name.trim().slice(0, 60));
    localStorage.removeItem(GUEST_KEY);
    localStorage.removeItem(PENDING_EMAIL_KEY);
    localStorage.removeItem(PENDING_NAME_KEY);
    return { ok: true };
  } catch { return { ok: false, error: "backend unavailable" }; }
}
export const login = (email: string, password: string) => authenticate("/auth/login", { email, password });
export const verifyLoginOtp = (email: string, code: string) => authenticate("/auth/login-otp/verify", { email, code });
export async function verifyMfaLogin(challengeToken: string, code: string): Promise<{ ok: boolean; error?: string }> { try { const res = await fetch(`${API}/auth/mfa/verify`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" }, body: JSON.stringify({ challengeToken, code }) }); const data = await readJson<{ expiresIn?: number } & ApiError>(res); if (!res.ok || typeof data.expiresIn !== "number") return { ok: false, error: data.error || "MFA verification failed" }; session = { accessToken: "", expiresIn: data.expiresIn }; return { ok: true }; } catch { return { ok: false, error: "backend unavailable" }; } }
export async function register(username: string, email: string, password: string, legal: { termsAccepted: true; termsVersion: string }): Promise<{ ok: boolean; error?: string; requiresVerification?: boolean }> { try { const res = await fetch(`${API}/auth/register`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" }, body: JSON.stringify({ username, email, password, termsAccepted: legal.termsAccepted, termsVersion: legal.termsVersion }) }); const data = await readJson<{ requiresVerification?: boolean } & ApiError>(res); if (!res.ok) return { ok: false, error: data.error || "account could not be created" }; if (data.requiresVerification) { localStorage.setItem(PENDING_EMAIL_KEY, email.trim().toLowerCase()); return { ok: true, requiresVerification: true }; } return { ok: false, error: "verification is required" }; } catch { return { ok: false, error: "backend unavailable" }; } }
export function getPendingVerificationEmail() { if (typeof window === "undefined") return ""; return localStorage.getItem(PENDING_EMAIL_KEY) || ""; }
/** One-tap guest sign-in: a private account with no email, kept on this device by the normal session. */
export async function startGuest(name: string, termsVersion: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API}/auth/guest`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" }, body: JSON.stringify({ name: name.trim().slice(0, 40), termsAccepted: true, termsVersion }) });
    const data = await readJson<{ expiresIn?: number } & ApiError>(res);
    if (!res.ok || typeof data.expiresIn !== "number") return { ok: false, error: data.error || "Guest sign-in isn't working right now." };
    session = { accessToken: "", expiresIn: data.expiresIn };
    localStorage.setItem(GUEST_KEY, "1");
    if (name.trim()) localStorage.setItem(SIGNUP_NAME_KEY, name.trim().slice(0, 60));
    return { ok: true };
  } catch { return { ok: false, error: "Guest sign-in isn't working right now." }; }
}
export function isGuest() { if (typeof window === "undefined") return false; return localStorage.getItem(GUEST_KEY) === "1"; }
/** The name typed at sign-in (for onboarding), then forgotten. */
export function takeSignupName() { if (typeof window === "undefined") return ""; const name = localStorage.getItem(SIGNUP_NAME_KEY) || ""; localStorage.removeItem(SIGNUP_NAME_KEY); return name; }
export function getPendingVerificationName() { if (typeof window === "undefined") return ""; return localStorage.getItem(PENDING_NAME_KEY) || ""; }
/** Logs out of this device: ends the server session, clears the sign-in cookies and this browser's sign-in state. */
// Personal data this browser keeps for the signed-in person: chat titles, onboarding answers and preferences. Cleared
// on log out so the next person on a shared device sees none of it. Theme and cookie choices are device settings and stay.
const PERSONAL_KEYS = ["jarvis.guest", "bobai.conversation-ui.v3", "bobai.conversations.v2", "jarvis.settings.v1", "bobai.settings.v1", "jarvis.voiceReplies"];
export async function logout() { session = null; for (const key of PERSONAL_KEYS) localStorage.removeItem(key); localStorage.removeItem(LEGACY_SESSION_KEY); localStorage.removeItem(ONBOARDING_KEY); localStorage.removeItem(PENDING_EMAIL_KEY); localStorage.removeItem(PENDING_NAME_KEY); localStorage.removeItem(SIGNUP_NAME_KEY); await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include", keepalive: true, headers: { "X-CSRF-Protection": "1" } }).catch(() => undefined); }
export function getSession(): Session | null { if (typeof window !== "undefined") localStorage.removeItem(LEGACY_SESSION_KEY); return session; }
export function clearSession() { session = null; }
// Refresh tokens rotate on every use and the server revokes the whole session family when a rotated token is
// replayed. Concurrent refreshes (parallel 401s, StrictMode double effects) would replay the same cookie, so all
// callers share one in-flight refresh.
let refreshInFlight: Promise<Session | null> | null = null;
export function refreshSession(): Promise<Session | null> { refreshInFlight ??= performRefresh().finally(() => { refreshInFlight = null; }); return refreshInFlight; }
// If another tab refreshed at the same moment, this request loses the race (401) but the winner has already set fresh
// cookies, so one quick retry picks them up instead of signing the person out.
const postRefresh = () => fetch(`${API}/auth/refresh`, { method: "POST", credentials: "include", headers: { "X-CSRF-Protection": "1" } });
async function performRefresh(): Promise<Session | null> {
  // A short production/API hiccup should not immediately make a returning user look signed out.
  // Retry transient network/5xx failures, while treating an invalid cookie as signed out after one
  // cross-tab race retry. Never persist tokens in browser storage.
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      res = await postRefresh();
      if (res.ok || (res.status >= 400 && res.status < 500)) break;
    } catch {
      res = null;
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
  }
  if (res?.status === 401) {
    // Another tab may have rotated the cookie immediately before this request.
    await new Promise((resolve) => setTimeout(resolve, 400));
    try { res = await postRefresh(); } catch { res = null; }
  }
  if (!res?.ok) { clearSession(); return null; }
  const next = await readJson<{ expiresIn?: number }>(res);
  if (typeof next.expiresIn !== "number") { clearSession(); return null; }
  session = { accessToken: "", expiresIn: next.expiresIn };
  return session;
}
export function hasCompletedOnboarding() { if (typeof window === "undefined") return false; return localStorage.getItem(ONBOARDING_KEY) === "complete"; }
export function saveOnboarding(_answers: unknown) { localStorage.setItem(ONBOARDING_KEY, "complete"); }
