const PASSWORD_MIN = 6;
const PASSWORD_MAX = 128;

export function validatePassword(password: unknown) {
  if (typeof password !== "string") return "password is required";
  if (password.length < PASSWORD_MIN) return "password must be at least 6 characters";
  if (password.length > PASSWORD_MAX) return "password must be 128 characters or fewer";
  if (/^\s+$/.test(password)) return "password cannot contain only whitespace";
  return null;
}

export async function enforcePasswordPolicy(password: unknown) {
  return validatePassword(password);
}
