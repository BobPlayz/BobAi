import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const scriptSources = isProduction ? "'self' 'unsafe-inline'" : "'self' 'unsafe-inline' 'unsafe-eval'";
const connectSources = isProduction ? "'self' https: wss:" : "'self' https: http://localhost:3000 http://localhost:3001 ws://localhost:3000 ws://localhost:3001";
// Local only: lets `next start` serve /api like Vercel does, by proxying to a locally running API. Never set on Vercel.
const localApiProxy = process.env.BOBAI_LOCAL_API_PROXY?.trim().replace(/\/+$/, "");
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Pictures and long replies can take over a minute; the proxy's default 30 s would cut them off.
  ...(localApiProxy ? { experimental: { proxyTimeout: 180_000 }, async rewrites() { return [{ source: "/api/:path*", destination: `${localApiProxy}/:path*` }]; } } : {}),
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        { key: "X-DNS-Prefetch-Control", value: "off" },
        { key: "Content-Security-Policy", value: `default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; script-src ${scriptSources}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: blob: https:; media-src 'self' blob:; connect-src ${connectSources}` },
      ],
    }, {
      // The website preview (see Markdown.tsx): sandboxed by this header (an isolated origin with no cookies or storage),
      // framed only by Jarvis itself, and no network access at all.
      source: "/preview-frame.html",
      headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Content-Security-Policy", value: "sandbox allow-scripts allow-forms allow-modals; default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; form-action 'none'; base-uri 'none'; frame-ancestors 'self'" },
      ],
    }];
  },
};

export default nextConfig;
