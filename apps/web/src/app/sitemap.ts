import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bobai.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/", "/about", "/faq", "/contact", "/waitlist"];
  return routes.map((path) => ({ url: `${baseUrl}${path}`, changeFrequency: path === "/" ? "weekly" : "monthly", priority: path === "/" ? 1 : 0.6 }));
}
