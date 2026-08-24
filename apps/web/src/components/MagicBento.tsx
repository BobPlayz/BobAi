"use client";

import { useState, type ReactNode } from "react";
import "./MagicBento.css";

export function MagicBentoCard({ label, title, description, children }: { label: string; title: string; description: string; children?: ReactNode }) {
  const [active, setActive] = useState(false);
  return <button type="button" className={`magic-bento-card ${active ? "active" : ""}`} onClick={() => setActive((value) => !value)}><span className="magic-bento-label">{label}</span><strong>{title}</strong><span>{description}</span>{children}</button>;
}

export default function MagicBento({ children }: { children: ReactNode }) {
  return <div className="magic-bento">{children}</div>;
}