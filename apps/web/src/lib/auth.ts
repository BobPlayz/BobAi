const ONBOARDING_KEY = "bobai_onboarding";
const PENDING_EMAIL_KEY = "bobai_pending_verification_email";
const PENDING_NAME_KEY = "bobai_pending_verification_name";
const LEGACY_SESSION_KEY = "bobai_session";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
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
    localStorage.removeItem(PENDING_EMAIL_KEY);
    localStorage.removeItem(PENDING_NAME_KEY);
    return { ok: true };
  } catch { return { ok: false, error: "backend unavailable" }; }
}
export const login = (email: string, password: string) => authenticate("/auth/login", { email, password });
export async function requestLoginOtp(email: string): Promise<{ ok: boolean; error?: string }> { try { const res = await fetch(`${API}/auth/login-otp/request`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" }, body: JSON.stringify({ email }) }); const data = await readJson<ApiError>(res); return res.ok ? { ok: true } : { ok: false, error: data.error || "sign-in code could not be sent" }; } catch { return { ok: false, error: "backend unavailable" }; } }
export const verifyLoginOtp = (email: string, code: string) => authenticate("/auth/login-otp/verify", { email, code });
export async function verifyMfaLogin(challengeToken: string, code: string): Promise<{ ok: boolean; error?: string }> { try { const res = await fetch(`${API}/auth/mfa/verify`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" }, body: JSON.stringify({ challengeToken, code }) }); const data = await readJson<{ expiresIn?: number } & ApiError>(res); if (!res.ok || typeof data.expiresIn !== "number") return { ok: false, error: data.error || "MFA verification failed" }; session = { accessToken: "", expiresIn: data.expiresIn }; return { ok: true }; } catch { return { ok: false, error: "backend unavailable" }; } }
export async function register(username: string, email: string, password: string, legal: { termsAccepted: true; termsVersion: string }): Promise<{ ok: boolean; error?: string; requiresVerification?: boolean }> { try { const res = await fetch(`${API}/auth/register`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" }, body: JSON.stringify({ username, email, password, termsAccepted: legal.termsAccepted, termsVersion: legal.termsVersion }) }); const data = await readJson<{ requiresVerification?: boolean } & ApiError>(res); if (!res.ok) return { ok: false, error: data.error || "account could not be created" }; if (data.requiresVerification) { localStorage.setItem(PENDING_EMAIL_KEY, email.trim().toLowerCase()); return { ok: true, requiresVerification: true }; } return { ok: false, error: "verification is required" }; } catch { return { ok: false, error: "backend unavailable" }; } }
export async function requestOtp(email: string): Promise<{ ok: boolean; error?: string }> { try { const res = await fetch(`${API}/auth/otp/request`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" }, body: JSON.stringify({ email }) }); const data = await readJson<{ message?: string } & ApiError>(res); if (!res.ok) return { ok: false, error: data.error || "verification email could not be sent right now" }; localStorage.setItem(PENDING_EMAIL_KEY, email.trim().toLowerCase()); return { ok: true }; } catch { return { ok: false, error: "backend unavailable" }; } }
export async function verifyOtp(email: string, code: string): Promise<{ ok: boolean; error?: string }> { try { const res = await fetch(`${API}/auth/otp/verify`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" }, body: JSON.stringify({ email, code }) }); const data = await readJson<{ verified?: boolean } & ApiError>(res); if (!res.ok) return { ok: false, error: data.error || "invalid or expired verification code" }; localStorage.removeItem(PENDING_EMAIL_KEY); return { ok: data.verified === true }; } catch { return { ok: false, error: "backend unavailable" }; } }
export function getPendingVerificationEmail() { if (typeof window === "undefined") return ""; return localStorage.getItem(PENDING_EMAIL_KEY) || ""; }
export function getPendingVerificationName() { if (typeof window === "undefined") return ""; return localStorage.getItem(PENDING_NAME_KEY) || ""; }
export function logout() { session = null; localStorage.removeItem(LEGACY_SESSION_KEY); localStorage.removeItem(ONBOARDING_KEY); localStorage.removeItem(PENDING_EMAIL_KEY); localStorage.removeItem(PENDING_NAME_KEY); void fetch(`${API}/auth/logout`, { method: "POST", credentials: "include", headers: { "X-CSRF-Protection": "1" } }).catch(() => undefined); }
export function getSession(): Session | null { if (typeof window !== "undefined") localStorage.removeItem(LEGACY_SESSION_KEY); return session; }
export function setSession(next: Session) { session = next; }
export function clearSession() { session = null; }
export async function refreshSession(): Promise<Session | null> { try { const res = await fetch(`${API}/auth/refresh`, { method: "POST", credentials: "include", headers: { "X-CSRF-Protection": "1" } }); if (!res.ok) { clearSession(); return null; } const next = await readJson<{ expiresIn?: number }>(res); if (typeof next.expiresIn !== "number") { clearSession(); return null; } session = { accessToken: "", expiresIn: next.expiresIn }; return session; } catch { return null; } }
export function isLoggedIn() { return session !== null; }
export function hasCompletedOnboarding() { if (typeof window === "undefined") return false; return localStorage.getItem(ONBOARDING_KEY) === "complete"; }
export function saveOnboarding(_answers: unknown) { localStorage.setItem(ONBOARDING_KEY, "complete"); }
