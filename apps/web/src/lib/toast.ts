/** Tiny confirmation pop-ups ("Copied", "Reported") so quick actions never feel like they did nothing. */
export const TOAST_EVENT = "jarvis:toast";
export function toast(message: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message.slice(0, 120) }));
}
