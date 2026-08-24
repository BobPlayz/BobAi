const SESSION_KEY = "bobai_session";
const ONBOARDING_KEY = "bobai_onboarding";

export const TEMP_ADMIN = {
  email: "admin@bobai.local",
  password: "bobai123",
};

export function login(email: string, password: string) {
  if (
    email === TEMP_ADMIN.email &&
    password === TEMP_ADMIN.password
  ) {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        email,
        role: "admin",
        createdAt: Date.now(),
      })
    );
    return true;
  }

  return false;
}

export function signup(username: string, email: string) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      username,
      email,
      role: "user",
      createdAt: Date.now(),
    })
  );

  return true;
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ONBOARDING_KEY);
}

export function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return getSession() !== null;
}

export function hasCompletedOnboarding() {
  return localStorage.getItem(ONBOARDING_KEY) === "complete";
}

export function saveOnboarding(answers: unknown) {
  localStorage.setItem(ONBOARDING_KEY, "complete");
  localStorage.setItem("bobai_onboarding_answers", JSON.stringify(answers));
}