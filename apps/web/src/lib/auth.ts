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
// Keep only device-level choices. All account-scoped browser state is discarded at logout.
const DEVICE_KEYS = ["jarvis.theme", "bobai-analytics-consent"] as const;
const LOGOUT_SIGNAL_KEY = "jarvis.logout.signal";
let sessionGeneration = 0;

function clearBrowserAccountState() {
  if (typeof window === "undefined") return;
  try {
    const deviceState = new Map<string, string>();
    for (const key of DEVICE_KEYS) {
      const value = window.localStorage.getItem(key);
      if (value !== null) deviceState.set(key, value);
    }
    window.localStorage.clear();
    for (const [key, value] of deviceState) window.localStorage.setItem(key, value);
    // Other open tabs receive this event and immediately leave the authenticated workspace.
    window.localStorage.setItem(LOGOUT_SIGNAL_KEY, String(Date.now()));
  } catch {
    // Storage may be disabled or full; do not block logout.
  }
  try { window.sessionStorage.clear(); } catch { /* Storage may be unavailable. */ }
}

/** Clears this account's server-side workspace data, retains its login identity, then signs out this device. */
export async function logout(options: { clearData?: boolean } = {}) {
  if (options.clearData !== false) {
    const clearAccountData = () => fetch(`${API}/account/data/clear`, { method: "POST", credentials: "include", headers: { "X-CSRF-Protection": "1" } });
    let cleared = await clearAccountData();
    // Access cookies last 15 minutes while refresh cookies last 30 days. Restore the session once
    // before treating an expired access cookie as a data-clear failure.
    if (cleared.status === 401) {
      const restored = await refreshSession();
      if (restored) cleared = await clearAccountData();
    }
    if (!cleared.ok) {
      const data = await readJson<{ error?: string }>(cleared);
      throw new Error(data.error || "Jarvis could not clear your account data. You are still signed in.");
    }
  }
  sessionGeneration += 1;
  session = null;
  refreshInFlight = null;
  try {
    await fetch(`${API}/auth/logout`, {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "X-CSRF-Protection": "1" },
    });
  } catch {
    // Always remove local account data even if the network is unavailable.
  } finally {
    clearBrowserAccountState();
  }
}
export function getSession(): Session | null { if (typeof window !== "undefined") localStorage.removeItem(LEGACY_SESSION_KEY); return session; }
export function clearSession() { session = null; sessionGeneration += 1; }
// Refresh tokens rotate on every use and the server revokes the whole session family when a rotated token is
// replayed. Concurrent refreshes (parallel 401s, StrictMode double effects) would replay the same cookie, so all
// callers share one in-flight refresh.
let refreshInFlight: Promise<Session | null> | null = null;
export function refreshSession(): Promise<Session | null> { refreshInFlight ??= performRefresh().finally(() => { refreshInFlight = null; }); return refreshInFlight; }
// If another tab refreshed at the same moment, this request loses the race (401) but the winner has already set fresh
// cookies, so one quick retry picks them up instead of signing the person out.
const postRefresh = () => fetch(`${API}/auth/refresh`, { method: "POST", credentials: "include", headers: { "X-CSRF-Protection": "1" } });
async function performRefresh(): Promise<Session | null> {
  const generationAtStart = sessionGeneration;
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
  if (generationAtStart !== sessionGeneration) return null;
  if (!res?.ok) { clearSession(); return null; }
  const next = await readJson<{ expiresIn?: number }>(res);
  if (generationAtStart !== sessionGeneration) return null;
  if (typeof next.expiresIn !== "number") { clearSession(); return null; }
  session = { accessToken: "", expiresIn: next.expiresIn };
  return session;
}
export function hasCompletedOnboarding() { if (typeof window === "undefined") return false; return localStorage.getItem(ONBOARDING_KEY) === "complete"; }
export function saveOnboarding(_answers: unknown) { localStorage.setItem(ONBOARDING_KEY, "complete"); }
