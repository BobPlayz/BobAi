/** Guest accounts live under the reserved .invalid domain, so no email can ever be sent to them. */
export const GUEST_EMAIL_DOMAIN = "guest.jarvis.invalid";
export function isGuestEmail(email: string | null | undefined) { return typeof email === "string" && email.toLowerCase().endsWith(`@${GUEST_EMAIL_DOMAIN}`); }

/** Jarvis signs people in with email codes. The old password routes stay off unless explicitly turned on. */
export function passwordLoginEnabled() { return process.env.BOBAI_PASSWORD_LOGIN?.trim().toLowerCase() === "true"; }
