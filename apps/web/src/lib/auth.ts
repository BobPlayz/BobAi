const SESSION_KEY = "bobai_session";
const ONBOARDING_KEY = "bobai_onboarding";
const PENDING_EMAIL_KEY = "bobai_pending_verification_email";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export type Session = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  email?: string;
  role?: string;
  username?: string;
};

export async function login(email: string, password: string): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return { ok: false };
    const session = (await res.json()) as Session;
    setSession(session);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function register(username: string, email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    const data = (await res.json().catch(() => ({}))) as Session & { error?: string };
    if (!res.ok) return { ok: false, error: data.error || "account could not be created" };
    setSession(data);
    return { ok: true };
  } catch {
    return { ok: false, error: "backend unavailable" };
  }
}

export async function requestOtp(email: string): Promise<boolean> {
  try {
    const res = await fetch(`${API}/auth/otp/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function verifyOtp(email: string, code: string): Promise<boolean> {
  try {
    const res = await fetch(`${API}/auth/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    if (!res.ok) return false;
    localStorage.removeItem(PENDING_EMAIL_KEY);
    return true;
  } catch {
    return false;
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
    const session = (await res.json()) as Session;
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
