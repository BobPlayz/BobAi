import assert from "node:assert/strict";
import test from "node:test";
import { buildStage, buildStageNote } from "../src/services/buildFlow.js";

const user = (content: string) => ({ role: "user", content });
const jarvis = (content: string) => ({ role: "assistant", content });

test("a short website request gets questions first, then the answer builds it", () => {
  assert.deepEqual(buildStage([user("build me a simple website")]), { stage: "ask", request: "build me a simple website" });
  const asked = [user("build me a simple website"), jarvis("1. What's it for?\n2. Colours?\nWant me to build it once you answer?")];
  assert.deepEqual(buildStage([...asked, user("my cricket team, blue and gold")]), { stage: "build", request: "build me a simple website" });
  assert.equal(buildStage([...asked, user("nah never mind")]), null);
  assert.match(buildStageNote(buildStage([user("make a portfolio site")])), /do NOT write any code/);
});

test("skipping questions, detailed requests, the setting and ordinary chat build or chat normally", () => {
  assert.equal(buildStage([user("just build it: a calculator website")]), null);
  assert.equal(buildStage([user("build me a website for my school science fair with a home page, a project gallery, a contact form, a dark blue theme, big headings and a countdown to the fair date")]), null);
  assert.equal(buildStage([user("build me a simple website")], false), null);
  assert.equal(buildStage([user("what is a website?")]), null);
  // A reply that already contained code was not a question round, so the next message is ordinary chat.
  assert.equal(buildStage([user("make a quiz game"), jarvis("```html\n<html></html>\n``` want changes?"), user("make it blue")]), null);
});
