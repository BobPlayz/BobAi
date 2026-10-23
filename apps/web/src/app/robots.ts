import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
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
        "/share",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
