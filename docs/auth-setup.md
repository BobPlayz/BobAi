# BobAI authentication setup

## local development

Copy `.env.example` to `.env` and set `DATABASE_URL`.

For real email OTP delivery, set `RESEND_API_KEY` and optionally `RESEND_FROM`.

Without a Resend key, development mode logs generated OTPs to the API console instead of sending email.

Email verification is optional. Registration and normal email/password login do not require OTP verification.
