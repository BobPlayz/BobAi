import { runDueResearchBriefs } from "./researchBriefs.js";
const INTERVAL_MS = 5 * 60_000;
export function startResearchBriefWorker() { const timer = setInterval(() => { void runDueResearchBriefs().catch((error) => { if (process.env.NODE_ENV !== "production") console.warn("research brief worker failed", error); }); }, INTERVAL_MS); timer.unref(); void runDueResearchBriefs().catch(() => undefined); return timer; }
