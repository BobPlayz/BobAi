import type { Metadata } from "next";
import AuthGate from "@/components/AuthGate";

export const metadata: Metadata = {
  title: "Settings",
  description: "Customize Jarvis",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
