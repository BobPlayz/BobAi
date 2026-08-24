"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import "./BorderGlow.css";

type Props = { children: ReactNode; className?: string; backgroundColor?: string; colors?: string[] };

export default function BorderGlow({ children, className = "", backgroundColor = "#071018", colors = ["#38bdf8", "#22d3ee", "#60a5fa"] }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    element.style.setProperty("--glow-x", `${event.clientX - rect.left}px`);
    element.style.setProperty("--glow-y", `${event.clientY - rect.top}px`);
  }

  const style = { "--card-bg": backgroundColor, "--glow-one": colors[0], "--glow-two": colors[1], "--glow-three": colors[2] } as CSSProperties;
  return <div ref={ref} className={`border-glow-card ${className}`} style={style} onPointerMove={handlePointerMove}><div className="border-glow-inner">{children}</div></div>;
}