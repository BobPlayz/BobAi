import "./globals.css";
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/neural/ThemeProvider";

export const metadata: Metadata = {
  title: "Bob AI",
  description: "Your intelligent AI workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div id="bobai-root" className="relative min-h-screen overflow-hidden">
          {/* global ambient environment */}
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
          >
            <div className="beam left-[-12rem] top-24" />
            <div className="beam left-[-10rem] top-72" />
            <div className="beam left-[-8rem] bottom-28" />

            <div
              className="particle left-[18%] top-[72%]"
              style={{ animationDuration: "9s" }}
            />
            <div
              className="particle left-[34%] top-[82%]"
              style={{ animationDuration: "11s" }}
            />
            <div
              className="particle left-[58%] top-[76%]"
              style={{ animationDuration: "13s" }}
            />
            <div
              className="particle left-[74%] top-[84%]"
              style={{ animationDuration: "10s" }}
            />
            <div
              className="particle left-[88%] top-[68%]"
              style={{ animationDuration: "12s" }}
            />
          </div>

          {/* persistent bobai application */}
          <div className="relative z-10 min-h-screen">
            <ThemeProvider>{children}</ThemeProvider>
          </div>
        </div>
      </body>
    </html>
  );
}