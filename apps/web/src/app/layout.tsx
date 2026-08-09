import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BobAI",
  description: "BobAI local assistant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-text antialiased">
        <div className="relative min-h-screen">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_40%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.08),transparent_35%)]" />
          <div className="relative z-10 min-h-screen">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}