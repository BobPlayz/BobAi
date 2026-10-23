/** Guest accounts live under the reserved .invalid domain, so no email can ever be sent to them. */
export const GUEST_EMAIL_DOMAIN = "guest.jarvis.invalid";
export function isGuestEmail(email: string | null | undefined) { return typeof email === "string" && email.toLowerCase().endsWith(`@${GUEST_EMAIL_DOMAIN}`); }
