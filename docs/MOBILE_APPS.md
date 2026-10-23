# Putting Jarvis in the Play Store (and later the App Store)

Jarvis is already an installable web app (a PWA): it has a manifest, icons, an offline page and the Android ownership
file. The store app is a thin wrapper that opens the live site full screen, so every website update reaches the app
instantly with no new release.

## Before you start

- **You need an adult.** Google and Apple only let people who are 18 or older own a developer account, so a parent or
  guardian has to create it (you can do the work in it with them).
- **Costs:** Google Play is a one-time $25. Apple is $99 every year.
- **New Google accounts must test first:** a new personal account has to run a closed test with a group of testers
  (currently at least 12 people for 14 days) before the app can go public. Check Play Console for the current rule.
- Add all the API keys in Vercel first (see the README), so the app works fully on day one.

## Android (Google Play)

1. Go to [pwabuilder.com](https://www.pwabuilder.com), enter `https://jarvis-x-ai-two.vercel.app` and choose
   **Package for stores → Android → Google Play**.
2. Pick a **package ID** that will never change, like `app.jarvis.assistant`. Download the zip. It contains the app
   (`.aab`), a **signing key** and an `assetlinks.json`.
3. **Keep the signing key safe** (a password manager or a USB stick). Never put it in GitHub or a chat. If you lose
   it you can't update the app.
4. In [Play Console](https://play.google.com/console): create the app, then upload the `.aab` to **Testing → Closed
   testing**.
5. In **Test and release → App integrity → App signing**, copy the **SHA-256 certificate fingerprint**. Also copy the
   fingerprint from the `assetlinks.json` PWABuilder gave you.
6. In Vercel, add these and redeploy:

   | Name | Value |
   |---|---|
   | `ANDROID_APP_PACKAGE` | your package ID, e.g. `app.jarvis.assistant` |
   | `ANDROID_APP_SHA256_FINGERPRINTS` | both fingerprints, separated by a comma |

   Then open `https://jarvis-x-ai-two.vercel.app/.well-known/assetlinks.json`: it should show your package ID. This
   is what makes the app open without a browser bar at the top.
7. Fill in the store listing:
   - **Privacy policy:** `https://jarvis-x-ai-two.vercel.app/privacy`
   - **Data safety:** collects name and email (guests: neither), chat messages and files you share, and voice
     recordings when talk mode is used; nothing is sold or used for ads; users can delete their account in the app.
   - **Content rating:** answer honestly that it's an AI chat app that creates text and pictures.
   - **AI-generated content:** users can report a reply from the ⋯ menu (**Report reply**). Reports show up in the
     Vercel logs as `ai_reply_reported`.
8. Run the closed test with your friends, then promote it to **Production**.

## iPhone (App Store), later

PWABuilder can also make an iOS project, but building it needs a Mac with Xcode, and Apple often rejects apps that
are "just a website" (guideline 4.2), so plan to add something app-only first. Until then, iPhone users can already
install Jarvis: open the site in Safari → Share → **Add to Home Screen**.
