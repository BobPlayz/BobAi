import { useId } from "react";

/** The Jarvis orrery mark (same artwork as the favicon, apps/web/brand/jarvis-mark.svg). Decorative by default. */
export default function JarvisMark({ className = "jarvis-mark", title }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 512 512" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2A2620" /><stop offset="1" stopColor="#15130F" /></linearGradient>
        <radialGradient id={`${id}p`} cx="0.38" cy="0.32" r="0.75"><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.55" stopColor="#EFE8DA" /><stop offset="1" stopColor="#C2B49A" /></radialGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#A9781F" /><stop offset="0.5" stopColor="#F0C766" /><stop offset="1" stopColor="#B8862B" /></linearGradient>
        <clipPath id={`${id}f`}><rect x="0" y="262" width="512" height="250" /></clipPath>
      </defs>
      <rect width="512" height="512" rx="116" fill={`url(#${id}bg)`} />
      <g transform="rotate(-18 256 268)"><ellipse cx="256" cy="268" rx="196" ry="60" fill="none" stroke={`url(#${id}b)`} strokeWidth="26" /></g>
      <circle cx="256" cy="268" r="108" fill={`url(#${id}p)`} />
      <g transform="rotate(-18 256 268)" clipPath={`url(#${id}f)`}><ellipse cx="256" cy="268" rx="196" ry="60" fill="none" stroke={`url(#${id}b)`} strokeWidth="26" /></g>
      <circle cx="392" cy="128" r="26" fill="#E2482A" />
    </svg>
  );
}
