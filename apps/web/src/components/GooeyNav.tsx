"use client";

import { useState } from "react";
import "./GooeyNav.css";

export default function GooeyNav({ items, initialActiveIndex = 0, activeIndex: controlledIndex, onChange }: { items: string[]; initialActiveIndex?: number; activeIndex?: number; onChange?: (index: number) => void }) {
  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);
  const selectedIndex = controlledIndex ?? activeIndex;
  return <nav className="gooey-nav" aria-label="Onboarding steps"><div className="gooey-nav-pill" style={{ "--active-index": selectedIndex } as React.CSSProperties} />{items.map((item, index) => <button type="button" key={item} className={selectedIndex === index ? "active" : ""} onClick={() => { setActiveIndex(index); onChange?.(index); }} aria-current={selectedIndex === index ? "step" : undefined}>{item}</button>)}</nav>;
}