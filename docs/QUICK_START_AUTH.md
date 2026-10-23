# Sign-in with an email code

The login page asks for a name, an email address and agreement to the Terms and Privacy Policy. Jarvis emails a 6-digit code; entering it starts a session and opens the chat. There is no password in this flow.

## Settings

- `DATABASE_URL`: Postgres with the current migrations applied.
- An email sender, one of:
  - **Gmail SMTP (free, no domain needed):** `BOBAI_EMAIL_PROVIDER=smtp`, `BOBAI_SMTP_HOST=smtp.gmail.com`, `BOBAI_SMTP_PORT=465`, `BOBAI_SMTP_USER` (your Gmail address), `BOBAI_SMTP_PASSWORD` (a Gmail app password), `BOBAI_SMTP_FROM=Jarvis <your Gmail address>`.
  - **Resend:** `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. Without a domain verified in Resend it only delivers to the Resend account owner. If SMTP is also set up, a refused Resend send is retried over SMTP.
- `BOBAI_TERMS_VERSION` (API) and `NEXT_PUBLIC_TERMS_VERSION` (website): optional, default `2026-10-13`; they must match.
- Local development only: `BOBAI_DEV_LOG_OTP=true` prints codes in the terminal instead of emailing them. It never works in production.

`GET /api/ready` shows `emailConfigured`, `emailProvider` and which providers are set up.

## How codes are protected

- 6 digits, valid for 10 minutes, single use, at most 5 wrong tries; stored hashed, never logged.
- One email per address per minute; at most 10 requests per address per 15 minutes. Requests always answer the same way, so nobody can test which emails have accounts.
- If sending fails, the code is deleted and the user sees "could not send a verification code"; the server log says why (never the code).
- Sessions use HttpOnly, Secure, SameSite=strict cookies with refresh-token rotation and reuse detection. In production, requests from other sites are rejected.

## Other account notes

- Two-factor (authenticator app) and social sign-in exist in the API and need `BOBAI_MFA_ENCRYPTION_KEY`; without it they refuse to run. An account that requires MFA must complete it; it is never bypassed.
- Account deletion: Settings → Privacy, confirmed with an email code. The account is disabled at once and removed after 30 days.
- An email code proves someone controls an inbox, not who they are. Collect as little personal information as possible.

## Tested

On a laptop with a real Postgres database: code request, wrong code rejected, correct code signs in, reused code rejected, session, refresh, logout, rate limits, two testers receiving codes over authenticated TLS SMTP, and a refused Resend send falling back to SMTP. Real Gmail delivery has to be checked with your Gmail account.
