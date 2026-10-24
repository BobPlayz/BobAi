import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Instrument_Serif, JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/neural/ThemeProvider";
import SiteNav from "@/components/SiteNav";
import CookieConsent from "@/components/CookieConsent";
import ServiceWorker from "@/components/ServiceWorker";
import Toaster from "@/components/Toaster";
import { siteUrl } from "@/lib/siteUrl";

// Type system: a characterful grotesque for headlines, a calm sans for reading, a mono for labels.
// next/font self-hosts these at build time, so no request goes to Google from the visitor's browser.
const display = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-display", display: "swap" });
const sans = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F2EDE3" }, { media: "(prefers-color-scheme: dark)", color: "#12110E" }] };

const site = siteUrl();
// Ownership codes from Google Search Console and Bing Webmaster Tools (Bing also feeds ChatGPT search and Copilot).
// Set them in Vercel; nothing is added while they are empty.
const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
const bingVerification = process.env.BING_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Jarvis", template: "%s | Jarvis" },
  description: "Jarvis is a free AI assistant: chat, homework and code help, builds simple websites for you, live news and weather with real sources, reads your files and photos, and talks back. It asks before doing stuff.",
  applicationName: "Jarvis",
  creator: "Origin Productions",
  publisher: "Origin Productions",
  generator: "Next.js",
  keywords: ["free AI assistant", "AI chat", "AI website builder", "homework help", "AI with sources", "coding help", "voice assistant", "Telugu AI", "Ollama", "Jarvis AI"],
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Jarvis",
    description: "A chill AI assistant that shows its sources, never makes up live scores, and asks before doing stuff.",
    type: "website",
    url: site,
    siteName: "Jarvis",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Jarvis workspace" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Jarvis",
    description: "A chill AI assistant that shows its sources, never makes up live scores, and asks before doing stuff.",
    images: ["/opengraph-image"],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  ...(googleVerification || bingVerification ? { verification: { ...(googleVerification ? { google: googleVerification } : {}), ...(bingVerification ? { other: { "msvalidate.01": bingVerification } } : {}) } } : {}),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <div id="jarvis-root" className="relative min-h-screen">
          <div className="relative z-10 min-h-screen">
            <ThemeProvider>
              <SiteNav />
              {children}
              <CookieConsent />
              <ServiceWorker />
              <Toaster />
            </ThemeProvider>
          </div>
        </div>
      </body>
    </html>
  );
}
