import { localSitesEnabled } from "./localSites.js";

/**
 * "Build me a simple website": instead of dumping code straight away, Jarvis first asks a few quick questions and
 * whether it may build (and, on a local computer, host) the site. The user's next message is the go-ahead, and that
 * turn builds it. Decided from the conversation itself, so it works after a reload and needs no stored state.
 */
const WEBSITE_REQUEST = /\b(build|make|create|code|design|generate)\b[\s\S]{0,60}\b(website|site|web ?page|web ?app|landing page|portfolio|homepage|calculator|quiz|to-?do list|game)\b/i;
const SKIP_QUESTIONS = /\b(just (?:build|make|do|code|create) it|no questions|don'?t ask|surprise me|skip (?:the )?questions|right now)\b/i;
const DECLINE = /^\s*(no|nah|nope|cancel|stop|never ?mind|don'?t)\b/i;

type Message = { role: string; content: string };
export type BuildStage = { stage: "ask" | "build"; request: string } | null;

export function isWebsiteRequest(text: string) { return WEBSITE_REQUEST.test(text); }

/** A detailed request (lots of words) already answers the questions, so it is built straight away. */
const detailed = (text: string) => text.trim().split(/\s+/).length >= 25;

export function buildStage(messages: Message[], askFirst = true): BuildStage {
  const last = messages.at(-1);
  if (!last || last.role !== "user") return null;
  if (isWebsiteRequest(last.content)) return askFirst && !SKIP_QUESTIONS.test(last.content) && !detailed(last.content) ? { stage: "ask", request: last.content } : null;
  // The reply before this one asked about a website (a question, no code): this message is the answer or go-ahead.
  const asked = messages.at(-2), original = messages.at(-3);
  if (asked?.role === "assistant" && original?.role === "user" && isWebsiteRequest(original.content) && !asked.content.includes("```") && asked.content.includes("?")) {
    return DECLINE.test(last.content) ? null : { stage: "build", request: original.content };
  }
  return null;
}

/** The one-turn instruction for each stage, placed right before the user's message so small models follow it. */
export function buildStageNote(stage: BuildStage) {
  if (!stage) return "";
  const hosting = localSitesEnabled() ? "build it and host it on localhost for them" : "build it so they can open it right here";
  return stage.stage === "ask"
    ? `this turn only: the user wants a website. do NOT write any code or HTML yet. reply with 2 or 3 short numbered questions that really matter for this site (for example what it's for or who it's for, colours or style, must-have parts), then ask permission in one line: "Want me to ${hosting} once you answer? Or say \\"just build it\\" and I'll pick." keep it short and friendly.`
    : `this turn: the user answered your questions about the website (or said go ahead). build it now: one complete HTML file in a single \`\`\`html code block, using their answers and sensible choices for anything they skipped. do not ask more questions. keep the text outside the code to one or two short sentences.`;
}
