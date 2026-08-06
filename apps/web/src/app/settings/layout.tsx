import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings • BobAI",
  description: "Customize BobAI",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}