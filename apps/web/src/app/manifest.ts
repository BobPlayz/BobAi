import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jarvis",
    short_name: "Jarvis",
    description: "An AI workspace for chat, research, creation, and development.",
    start_url: "/",
    display: "standalone",
    background_color: "#07090c",
    theme_color: "#07090c",
    icons: [{ src: "/bob-logo.ico", sizes: "any", type: "image/x-icon" }],
  };
}
