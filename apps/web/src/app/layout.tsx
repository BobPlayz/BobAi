import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/neural/ThemeProvider";
import SiteNav from "@/components/SiteNav";
import CookieConsent from "@/components/CookieConsent";

// "Observatory" type system: a characterful grotesque for headlines, a calm sans for reading, a mono for labels.
// next/font self-hosts these at build time, so no request goes to Google from the visitor's browser.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F5F7FA" }, { media: "(prefers-color-scheme: dark)", color: "#0A1226" }] };

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: { default: "Jarvis", template: "%s | Jarvis" },
  description: "Jarvis is a local-first AI assistant: chat, code, live weather, research with sources, files and an offline voice — running on your own computer.",
  applicationName: "Jarvis",
  creator: "Origin Productions",
  publisher: "Origin Productions",
  generator: "Next.js",
  keywords: ["AI workspace", "AI assistant", "AI chat", "AI tools", "research", "coding"],
  manifest: "/manifest.webmanifest",
  ...(siteUrl ? { alternates: { canonical: siteUrl } } : {}),
  openGraph: {
    title: "Jarvis",
    description: "An AI workspace for chat, research, creation, and development.",
    type: "website",
    ...(siteUrl ? { url: siteUrl } : {}),
    siteName: "Jarvis",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Jarvis workspace" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Jarvis",
    description: "An AI workspace for chat, research, creation, and development.",
    images: ["/opengraph-image"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <div id="jarvis-root" className="relative min-h-screen">
          <div className="relative z-10 min-h-screen">
            <ThemeProvider>
              <SiteNav />
              {children}
              <CookieConsent />
            </ThemeProvider>
          </div>
        </div>
      </body>
    </html>
  );
}
