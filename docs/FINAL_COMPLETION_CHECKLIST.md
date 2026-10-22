# Jarvis final completion checklist

**Purpose:** the remaining work to take Jarvis from a repository that builds to a usable, verified application. Code presence alone does not mean a feature is complete. Check items off only after the named behavior has been exercised.

## 1. Required local setup

- [ ] Confirm the root `.env` has the real `DATABASE_URL`; never commit it.
- [ ] Start PostgreSQL/Neon and run `npm run db:migrate`; verify a fresh database and an upgrade path.
- [ ] Confirm Ollama is reachable and `/api/ready` shows `modelReachable: true` with sensible `modelPicks`.
- [ ] Run `npm run setup:glasses-voice` if the Alan/Venkatesh voice files need to be restored.
- [ ] Run `npm run setup:native-media` to obtain/check eSpeak data, download the Whisper Base model, update the two corresponding `.env` paths, and attempt a native build if compatible C++ libraries are configured.
- [ ] Resolve the native build blocker: install/configure compatible Windows x64 Piper and whisper.cpp C++ development packages, including headers and import libraries. Set process-level `BOBAI_PIPER_ROOT` and `BOBAI_WHISPER_ROOT`, then rerun `npm run setup:native-media`. The voice ONNX files alone cannot build this addon.
- [ ] Confirm the native addon file exists at `native/media/build/Release/bobai_media.node` and check `GET /voice/status` reports speech synthesis and recognition ready.
- [ ] If voice is not required for the first UI demo, mark it **not ready**, do not claim it works, and continue with the non-voice checklist.
- [ ] Run `npm run setup:image-generation` for the lightweight local Tiny-SD profile, or `npm run setup:image-generation -- -Profile quality` to download the larger local DreamShaper 8 model. Both require internet only for the initial model download; review the selected model's license and available disk space first.
- [ ] On an 8 GB CPU-only laptop, start with Tiny-SD if RAM is tight. DreamShaper 8 can improve image detail and composition, but it can take much longer and may still run out of memory. The setup command deliberately configures the local provider and does not require a hosted image API.
- [ ] Run `npm run test:image-generation` and confirm a real PNG is saved to `storage/image-generation-smoke.png`; then test `POST /images/generate` through the authenticated app and verify image history, chat reload/reopen persistence, cancellation, clear setup errors, and offline inference.

## 2. Full local verification

Run from the repository root, in this order, fixing failures before continuing:

1. `npm ci`
2. `npm test`
3. `npm run build`
4. `npm run audit`
5. `npm run repo:preflight`
6. `npm run db:migrate`
7. `npm run smoke` while the required services are actually running

Then test manually in the browser with the API and web app running:

- [ ] Sign in, sign out, refresh the session, expire/recover a session, and verify OTP delivery.
- [ ] Create chats, stream a reply, stop generation, reload, reopen, rename, pin, and delete conversations.
- [ ] Verify memory save/recall/disable/clear and test that separate users cannot read each other's conversations, files, memories, or workspaces.
- [ ] Upload supported files, corrupt files, and oversized files; verify errors are clear and no partial/cross-user data is exposed.
- [ ] Test local chat, coding, vision, web search/research, tool approval/cancellation, and image generation/editing separately. Record failures rather than treating the UI control as proof.
- [ ] Test English and Telugu speech-to-text and Alan/Venkatesh text-to-speech, including noisy input, blank input, long audio, cancellation, and browser playback.
- [ ] Check account export/deletion, notifications, reminders, settings persistence, theme toggle, keyboard navigation, reduced motion, mobile layout, and browser console/network errors.

## 3. Product polish and launch blockers

- [ ] Review every route and every visible control; remove placeholder, duplicate, dead, or misleading pages and links.
- [ ] Capture desktop and mobile screenshots in both themes; fix layout, contrast, focus states, loading, empty, error, and success states.
- [ ] Complete a security review of authentication/authorization, rate limits, CORS/CSRF, uploads, secrets, SSRF protections, cross-user isolation, account deletion, and multi-instance job behavior.
- [ ] Configure and test real OTP delivery (the code must actually send mail, not merely have a Resend key in `.env`).
- [ ] Finalize truthful Terms, Privacy, contact/support, retention, and data-export/deletion descriptions. Get appropriate adult/legal review for the intended audience and data handling.
- [ ] Choose deployment architecture and domain; configure production secrets, HTTPS, database backups, monitoring, alerts, migrations, rollback, and rate limits. Do not expose a local Ollama endpoint directly to the public internet.
- [ ] Test a clean install on the actual target machine and document exact setup, recovery, backup, and update steps.

## Definition of done

Jarvis is **demo-ready** when the core local chat, persistence, main UI, and explicitly selected demo features pass live tests on the target laptop.

Jarvis is **launch-ready** only after all relevant tests pass, security/privacy review is complete, real email/database/hosting operations work, legal/contact information is accurate, backups and rollback are tested, and there are no known critical or high-severity blockers.

A static code review, a green build, or a completed roadmap does not by itself certify the application as fully complete.
