import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings • Jarvis",
  description: "Customize Jarvis",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}