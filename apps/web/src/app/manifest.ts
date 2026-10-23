import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Jarvis",
    short_name: "Jarvis",
    description: "A chill AI assistant that shows its sources, talks with you and builds little websites.",
    lang: "en",
    start_url: "/chat",
    scope: "/",
    display: "standalone",
    orientation: "any",
    categories: ["education", "productivity", "utilities"],
    background_color: "#F2EDE3",
    theme_color: "#15130F",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New chat", short_name: "Chat", url: "/chat", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Settings", url: "/settings", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
