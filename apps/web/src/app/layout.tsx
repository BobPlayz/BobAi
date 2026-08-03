import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BobAI",
  description: "Your AI. Your rules.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0a0a0a] text-white">
        {children}
      </body>
    </html>
  );
}