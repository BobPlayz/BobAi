"use client";

import Link from "next/link";
import "./PillNav.css";

export default function PillNav({ items }: { items: { label: string; href: string }[] }) {
  return <nav className="pill-nav" aria-label="Primary navigation"><Link className="pill-nav-logo" href="/chat">B</Link><div className="pill-nav-links">{items.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</div></nav>;
}