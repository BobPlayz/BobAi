const BLOCKED_PATTERNS = [
  /\b(child|minor|underage|kid|teen|teenager)\b.{0,80}\b(nude|naked|sexual|sex|porn|erotic|explicit)\b/i,
  /\b(nude|naked|sexual|sex|porn|erotic|explicit)\b.{0,80}\b(child|minor|underage|kid|teen|teenager)\b/i,
  /\b(gore|gory|dismember|decapitat|graphic violence)\b/i,
];
export function assertMediaPromptSafe(prompt: string) { if (BLOCKED_PATTERNS.some((pattern) => pattern.test(prompt))) throw new Error("media request violates the safety policy"); return true; }
