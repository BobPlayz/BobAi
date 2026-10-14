import test from "node:test";
import assert from "node:assert/strict";
import { inferTaskPlan } from "../src/services/modelRuntime.js";

test("image-generation requests select image generation before image analysis", () => {
  const plan = inferTaskPlan({ messages: [{ role: "user", content: "Create an image of a cat" }] });
  assert.equal(plan.primary, "image");
  assert.ok(plan.capabilities.includes("image"));
  assert.equal(plan.capabilities.includes("vision"), false);
});

test("speech-output requests select TTS instead of speech recognition", () => {
  const plan = inferTaskPlan({ messages: [{ role: "user", content: "Give me a voice response" }] });
  assert.equal(plan.primary, "tts");
  assert.ok(plan.capabilities.includes("tts"));
  assert.equal(plan.capabilities.includes("asr"), false);
});

test("image-understanding requests continue to select vision", () => {
  const plan = inferTaskPlan({ messages: [{ role: "user", content: "What is in this picture?" }] });
  assert.equal(plan.primary, "vision");
  assert.ok(plan.capabilities.includes("vision"));
});

test("ordinary conversation defaults to chat", () => {
  const plan = inferTaskPlan({ messages: [{ role: "user", content: "Tell me a fun fact" }] });
  assert.equal(plan.primary, "chat");
  assert.equal(plan.modelId, "bob");
});
