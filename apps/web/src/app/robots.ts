import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about", "/faq", "/contact", "/demo", "/privacy", "/terms"],
      disallow: [
        "/api/",
        "/login",
        "/chat",
        "/onboarding",
        "/workspace",
        "/settings",
        "/library",
        "/account",
        "/admin",
        "/agents",
        "/automations",
        "/projects",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
