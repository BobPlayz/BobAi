import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://bobai.app").replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about", "/faq", "/contact", "/waitlist", "/privacy", "/terms"],
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
        "/thank-you",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
