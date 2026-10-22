"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/** Fades and lifts its children into view the first time they scroll on screen. */
export function Reveal({ children, delay = 0, as = "div", className = "" }: { children: ReactNode; delay?: number; as?: "div" | "li" | "section"; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // The element type only changes semantics; typing it as div keeps the ref simple.
  const Tag = as as "div";
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!("IntersectionObserver" in window)) { node.classList.add("is-in"); return; }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add("is-in"); observer.unobserve(entry.target); }
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <Tag ref={ref} className={`reveal ${className}`} style={{ "--delay": `${delay}ms` } as CSSProperties}>{children}</Tag>;
}

/** Splits a line into words that slide up one after another. Screen readers get the plain sentence. */
export function SplitWords({ text, start = 0, step = 70, className = "" }: { text: string; start?: number; step?: number; className?: string }) {
  const words = text.split(" ");
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, index) => (
          <span key={`${word}-${index}`} className="split-word">
            <span style={{ "--delay": `${start + index * step}ms` } as CSSProperties}>{word}{index < words.length - 1 ? " " : ""}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

/** Pulls an element slightly toward the pointer. Pointer-fine devices only; off under reduced motion. */
export function Magnetic({ children, strength = 0.25 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    const move = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      const x = event.clientX - (rect.left + rect.width / 2);
      const y = event.clientY - (rect.top + rect.height / 2);
      node.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    };
    const leave = () => { node.style.transform = ""; };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerleave", leave);
    return () => { node.removeEventListener("pointermove", move); node.removeEventListener("pointerleave", leave); };
  }, [strength]);
  return <span ref={ref} className="inline-block" style={{ transition: "transform 500ms cubic-bezier(0.16,1,0.3,1)" }}>{children}</span>;
}

/** A thin accent line at the top of the viewport that tracks reading progress. */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      ref.current?.style.setProperty("--progress", String(max > 0 ? window.scrollY / max : 0));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (frame) cancelAnimationFrame(frame); };
  }, []);
  return <div ref={ref} className="scroll-progress" aria-hidden="true" />;
}
