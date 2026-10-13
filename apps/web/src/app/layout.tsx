import "./globals.css";
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/neural/ThemeProvider";
import SiteNav from "@/components/SiteNav";
import CookieConsent from "@/components/CookieConsent";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://bobai.app").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Bob AI", template: "%s | Bob AI" },
  description: "An AI workspace for chat, research, creation, development, memory, files, tools, agents, and automations.",
  applicationName: "Bob AI",
  generator: "Next.js",
  keywords: ["AI workspace", "AI assistant", "AI chat", "AI tools", "research", "coding"],
  icons: { icon: "/bob-logo.ico" },
  manifest: "/manifest.webmanifest",
  alternates: { canonical: siteUrl },
  openGraph: {
    title: "Bob AI",
    description: "An AI workspace for chat, research, creation, and development.",
    type: "website",
    url: siteUrl,
    siteName: "Bob AI",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Bob AI workspace" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bob AI",
    description: "An AI workspace for chat, research, creation, and development.",
    images: ["/opengraph-image"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div id="bobai-root" className="relative min-h-screen overflow-hidden">
          <div className="relative z-10 min-h-screen">
<ThemeProvider>
              <SiteNav />
              {children}
            </ThemeProvider>
          </div>
          <CookieConsent />
        </div>
      </body>
    </html>
  );
}
