import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bobai.app";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy", "/terms"],
      disallow: ["/api/", "/login", "/workspace", "/settings", "/library"],
    },
    sitemap: `${base.replace(/\/$/, "")}/sitemap.xml`,
  };
}
