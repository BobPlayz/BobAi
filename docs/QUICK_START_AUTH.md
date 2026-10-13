# BobAI email OTP quick-start

The browser entry flow asks for a display name, email address, and agreement to the current Terms and Privacy Policy. It sends a one-time code to that email; successful verification establishes a server-managed session cookie and sends the user directly to chat. No password is required in this visible flow.

## Required production configuration

- `DATABASE_URL`: a working Postgres database with the current BobAI schema/migrations applied.
- `BOBAI_SMTP_HOST`, `BOBAI_SMTP_PORT`, and `BOBAI_SMTP_FROM`: working email delivery. If the SMTP server requires authentication, also set `BOBAI_SMTP_USER` and `BOBAI_SMTP_PASSWORD`.
- `BOBAI_WEB_URL` and `CORS_ORIGIN`: the actual deployed web origin(s).
- `BOBAI_TERMS_VERSION`: optional server-side accepted terms version. If set, it must match `NEXT_PUBLIC_TERMS_VERSION` in the web build.
- `NEXT_PUBLIC_TERMS_VERSION`: the version/date displayed as accepted by the frontend. Default is `2026-10-13`; change it whenever the legal terms version changes, and keep it synchronized with the API configuration.

In development, OTP codes are logged by the API if SMTP is not configured. This development fallback must not be used in production. Production should fail closed when SMTP is missing.

## Security and account notes

- Codes are six digits, expire after ten minutes, and have bounded attempts and request throttling.
- Session cookies are HttpOnly and Secure in production; the API refreshes the session through the existing refresh-token rotation logic.
- Existing password, OAuth, and OTP endpoints remain in the API for compatibility, but the visible login page now uses the quick-start flow.
- Accounts with an additional authenticator-based MFA requirement must complete the existing MFA flow; the quick-start flow does not bypass MFA.
- Email verification proves control of an inbox, not a person's legal identity.
- Before public launch, review the privacy/terms text and age-appropriate requirements with a responsible adult/legal adviser. Do not collect more personal information than necessary.
- Do not commit real SMTP credentials, database URLs, or AI provider keys.
