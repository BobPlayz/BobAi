import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const scriptSources = isProduction ? "'self' 'unsafe-inline'" : "'self' 'unsafe-inline' 'unsafe-eval'";
const connectSources = isProduction ? "'self' https: wss:" : "'self' https: http://localhost:3000 http://localhost:3001 ws://localhost:3000 ws://localhost:3001";
const nextConfig: NextConfig = {
  poweredByHeader: false,
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
    }];
  },
};

export default nextConfig;
