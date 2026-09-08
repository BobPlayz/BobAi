# BobAI launch checklist

## site

- [x] internal navigation links
- [x] custom 404 page
- [x] breadcrumbs on public content pages
- [x] primary CTA above the fold via the global `Try Bob AI` navigation CTA
- [x] five FAQs
- [x] thank-you page
- [x] accessible image strategy: no raw `<img>` tags are currently present; meaningful future images must include descriptive alt text
- [ ] real user reviews — requires genuine user feedback; no testimonials are fabricated
- [x] unique titles/descriptions for public launch pages
- [x] responsive navigation bar
- [x] analytics consent gate; provider is opt-in and configured through `NEXT_PUBLIC_ANALYTICS_DOMAIN`
- [ ] real team photo — requires an actual approved team photo
- [ ] complete production authorization/RLS audit across every data endpoint
- [x] SEO metadata, sitemap, robots, Open Graph metadata and favicon
- [x] waitlist page UI
- [x] cookie/analytics consent UI
- [x] public Privacy Policy page
- [x] public Terms of Service page
- [x] required Terms acceptance at signup, recorded with the accepted terms version
- [x] about page
- [x] contact page UI
- [x] favicon configured from the existing Bob AI icon

## security/code readiness

- [x] authenticated route protection and generic unauthorized responses
- [x] production error sanitization
- [x] provider URL/timeout/response-size hardening
- [x] workspace authorization before tool preparation
- [x] fail-closed behavior when workspace authorization is unavailable
- [x] approval gates for coding, browser, website testing, voice, automation, video, image, music, diagrams and sketch-to-UI tools
- [x] durable, hashed, single-use tool/MCP approval records with expiry
- [x] runtime validation of structured tool-result envelopes
- [x] coding-agent result/status validation
- [x] conversation-save serialization against same-conversation races
- [x] migration runner locking, checksums and existing-schema reconciliation
- [x] public `/health` and `/v1/health` smoke checks
- [x] security test suite baseline
- [x] production build baseline
- [x] reauthentication for password changes and account deletion
- [x] refresh/logout CSRF protection
- [x] scoped per-user limits for expensive vision, voice and image operations
- [x] expired auth/session/approval cleanup worker
- [x] TOTP MFA enrollment, encrypted secret storage, login challenge and step-up disable flow
- [x] permanent account-deletion worker with a 30-day retention window; shared-workspace owners are held for explicit ownership resolution
- [ ] distributed rate limiting for multi-instance production
- [ ] production RLS authorization audit and integration tests
- [ ] durable production object storage
- [ ] production AI/media provider configuration
- [ ] fresh empty-database bootstrap verification from a tracked baseline migration
- [ ] production coding-agent sandbox with real isolation and resource limits
- [ ] child-data/parental-consent workflow where required by the launch jurisdictions
- [ ] final legal review and operator/contact/provider/retention details in the public policies

## before launch

1. Pull the latest `main` and run the local smoke test, security tests, database migration check and production build.
2. Manually test signup, Terms acceptance, OTP verification, login, MFA login when enabled, logout, password reset, password change, sessions and chat in a browser.
3. Configure `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_SITE_DOMAIN` for the real domain.
4. Configure Resend and the real contact destination before accepting real email/contact traffic.
5. Connect the waitlist form to a real persistence/provider endpoint before accepting real signups.
6. Configure the production database and verify migrations on it.
7. Configure the production inference/media providers and durable object storage.
8. Deploy the web and API over HTTPS, then test authentication and chat from another device/network.
9. Complete the production authorization/RLS review and integration tests.
10. Complete the jurisdiction-specific privacy/terms review, including operator identity, contacts, provider inventory, retention schedule and any child-data consent requirements.
11. Add genuine reviews and the approved real team photo only if they are actually available.
12. Schedule `npm run account:delete` as a protected operational job and perform the final production load, backup/restore, monitoring and failure-mode checks.
