import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bob AI",
  description: "Cinematic AI workspace",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
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

          {children}
        </div>
      </body>
    </html>
  );
}