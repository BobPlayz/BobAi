const SESSION_KEY = "bobai_session";
const ONBOARDING_KEY = "bobai_onboarding";
const PENDING_EMAIL_KEY = "bobai_pending_verification_email";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type ApiError = { error?: string };

export type Session = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  email?: string;
  role?: string;
  username?: string;
};

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

export async function login(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await readJson<Session & ApiError>(res);
    if (!res.ok) return { ok: false, error: data.error || "invalid email or password" };
    if (typeof data.accessToken !== "string" || typeof data.refreshToken !== "string") return { ok: false, error: "invalid session from backend" };
    setSession(data);
    return { ok: true };
  } catch {
    return { ok: false, error: "backend unavailable" };
  }
}

export async function register(username: string, email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await readJson<Session & ApiError>(res);
    if (!res.ok) return { ok: false, error: data.error || "account could not be created" };
    if (typeof data.accessToken !== "string" || typeof data.refreshToken !== "string") return { ok: false, error: "invalid session from backend" };
    setSession(data);
    return { ok: true };
  } catch {
    return { ok: false, error: "backend unavailable" };
  }
}

export async function requestOtp(email: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API}/auth/otp/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await readJson<{ message?: string } & ApiError>(res);
    if (!res.ok) return { ok: false, error: data.error || "verification email could not be sent right now" };
    localStorage.setItem(PENDING_EMAIL_KEY, email.trim().toLowerCase());
    return { ok: true };
  } catch {
    return { ok: false, error: "backend unavailable" };
  }
}

export async function verifyOtp(email: string, code: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API}/auth/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await readJson<{ verified?: boolean } & ApiError>(res);
    if (!res.ok) return { ok: false, error: data.error || "invalid or expired verification code" };
    localStorage.removeItem(PENDING_EMAIL_KEY);
    return { ok: data.verified === true };
  } catch {
    return { ok: false, error: "backend unavailable" };
  }
}

export function getPendingVerificationEmail() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(PENDING_EMAIL_KEY) || "";
}

export function logout() {
  const session = getSession();
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ONBOARDING_KEY);
  localStorage.removeItem(PENDING_EMAIL_KEY);
  if (session?.refreshToken) {
    void fetch(`${API}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    }).catch(() => undefined);
  }
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (typeof parsed.accessToken !== "string" || typeof parsed.refreshToken !== "string") return null;
    return parsed as Session;
  } catch {
    return null;
  }
}

export function setSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export async function refreshSession(): Promise<Session | null> {
  const current = getSession();
  if (!current?.refreshToken) return null;
  try {
    const res = await fetch(`${API}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });
    if (!res.ok) {
      clearSession();
      return null;
    }
    const session = await readJson<Session>(res);
    if (typeof session.accessToken !== "string" || typeof session.refreshToken !== "string") {
      clearSession();
      return null;
    }
    setSession(session);
    return session;
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return getSession() !== null;
}

export function hasCompletedOnboarding() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ONBOARDING_KEY) === "complete";
}

export function saveOnboarding(answers: unknown) {
  localStorage.setItem(ONBOARDING_KEY, "complete");
  localStorage.setItem("bobai_onboarding_answers", JSON.stringify(answers));
}
