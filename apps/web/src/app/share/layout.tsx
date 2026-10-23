import type { ReactNode } from "react";

export const metadata = { title: "Shared chat", description: "A chat someone shared from Jarvis.", robots: { index: false, follow: false } };

export default function ShareLayout({ children }: { children: ReactNode }) { return children; }
