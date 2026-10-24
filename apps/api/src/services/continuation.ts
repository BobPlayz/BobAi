/**
 * Finishing replies that were cut off (the model hit its length budget, or the connection to it dropped). Instead of
 * returning half an answer as if it were complete, Jarvis asks the model to carry on from exactly where it stopped
 * and stitches the pieces together, dropping anything the model repeats. Code fences stay intact.
 */
export const CONTINUE_PROMPT = "Your previous reply was cut off. Continue it from exactly where it stopped, starting with the very next character. Do not repeat anything already written, do not apologise or explain, and if a code block is still open, keep writing inside it (do not start a new ``` fence).";
export const MAX_CONTINUATIONS = 3;

/** The continuation request, quoting the last lines so the model knows exactly where to resume. */
export function continuePrompt(soFar: string) {
  const tail = soFar.slice(-240);
  return `${CONTINUE_PROMPT}\n\nYour reply currently ends with:\n<<<\n${tail}\n>>>\nWrite only what comes right after that.`;
}

/** True when the text has a ``` code fence that was opened but never closed. */
export function hasOpenFence(text: string) {
  return ((text.match(/^[ \t]*```/gm) ?? []).length % 2) === 1;
}

/** The part of `next` that is new: overlap with the end of `previous` and a re-opened code fence are removed. */
export function joinContinuation(previous: string, next: string) {
  const longest = Math.min(600, previous.length, next.length);
  for (let size = longest; size >= 12; size -= 1) {
    if (previous.endsWith(next.slice(0, size))) return next.slice(size);
  }
  if (hasOpenFence(previous) && /^\s*```[\w-]*[ \t]*\n/.test(next)) return next.replace(/^\s*```[\w-]*[ \t]*\n/, "");
  return next;
}

/**
 * Wraps a token callback for a continuation: holds back the first `window` characters until the overlap with what
 * was already written can be judged, then streams normally. `finish()` flushes whatever is still held back.
 */
export function continuationEmitter(previous: string, emit: (text: string) => void, window = 400) {
  let held = "";
  let flushed = false;
  let added = "";
  const release = () => { const piece = joinContinuation(previous, held); flushed = true; held = ""; if (piece) { added += piece; emit(piece); } };
  return {
    onToken(token: string) { if (flushed) { added += token; emit(token); return; } held += token; if (held.length >= window) release(); },
    finish() { if (!flushed) release(); return added; },
  };
}
