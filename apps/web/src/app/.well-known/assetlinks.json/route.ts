/**
 * Digital Asset Links: proves to Android that the Jarvis app in the Play Store and this website belong together, so
 * the app (a Trusted Web Activity) opens the site full screen without a browser bar. Empty until both values are set:
 *   ANDROID_APP_PACKAGE=com.example.jarvis
 *   ANDROID_APP_SHA256_FINGERPRINTS=AA:BB:...  (comma-separated; from Play Console → App integrity → App signing)
 */
const PACKAGE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export function GET() {
  const packageName = process.env.ANDROID_APP_PACKAGE?.trim() ?? "";
  const fingerprints = (process.env.ANDROID_APP_SHA256_FINGERPRINTS ?? "").split(",").map((value) => value.trim().toUpperCase()).filter((value) => FINGERPRINT.test(value));
  const links = PACKAGE.test(packageName) && fingerprints.length
    ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: packageName, sha256_cert_fingerprints: fingerprints } }]
    : [];
  return Response.json(links, { headers: { "Cache-Control": "public, max-age=3600" } });
}
