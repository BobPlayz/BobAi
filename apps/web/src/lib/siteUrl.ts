/**
 * The site's public address for metadata, robots.txt and the sitemap. A localhost value copied from .env.example is
 * ignored on Vercel in favour of the deployment's production domain, so link previews and search engines never get
 * pointed at localhost.
 */
export function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  const local = !configured || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(configured);
  // Vercel sets both; only the NEXT_PUBLIC_ one reaches code that runs in the browser.
  const production = (process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL)?.trim();
  if (local && production) return `https://${production}`;
  return configured || "http://localhost:3000";
}
