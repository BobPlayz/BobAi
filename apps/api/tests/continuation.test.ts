import assert from "node:assert/strict";
import test from "node:test";
import { continuationEmitter, hasOpenFence, joinContinuation } from "../src/services/continuation.js";

test("a continuation that restarts the half-written line is trimmed, and a re-opened fence is dropped", () => {
  const before = "Here you go:\n```html\n<button onclick=\"press('7')\">7</button>\n<button onclick=\"pre";
  assert.equal(hasOpenFence(before), true);
  assert.equal(hasOpenFence(`${before}ss('8')">8</button>\n\`\`\``), false);
  // The model starts the cut line again: only the genuinely new part is kept.
  assert.equal(joinContinuation(before, "<button onclick=\"press('8')\">8</button>"), "ss('8')\">8</button>");
  // A clean continuation is kept as is.
  assert.equal(joinContinuation(before, "ss('8')\">8</button>\n```"), "ss('8')\">8</button>\n```");
  // A new ```html fence inside an already-open block is dropped, so the code stays one block.
  assert.equal(joinContinuation(before, "```html\nss('8')\">8</button>"), "ss('8')\">8</button>");
  assert.equal(joinContinuation("all done.", "Next part"), "Next part");
});

test("the continuation emitter holds back the start until overlap is known, then streams the rest", () => {
  const out: string[] = [];
  const previous = `${"x".repeat(50)}const total = add(1, 2);\n`;
  const emitter = continuationEmitter(previous, (text) => out.push(text), 40);
  for (const token of ["const total = ", "add(1, 2);\n", "console.log(total);", "\n```"]) emitter.onToken(token);
  const added = emitter.finish();
  assert.equal(added, "console.log(total);\n```");
  assert.equal(out.join(""), added);
  const short = continuationEmitter("abc", () => undefined);
  short.onToken("def");
  assert.equal(short.finish(), "def");
});
