import test from "node:test";
import assert from "node:assert/strict";
import { extractImagePrompt } from "../src/services/imagePrompt.js";

test("explicit image requests extract only the image subject", () => {
  assert.equal(extractImagePrompt("generate an image of a cat in a space suit"), "a cat in a space suit");
  assert.equal(extractImagePrompt("make me a logo for BobAI"), "BobAI");
  assert.equal(extractImagePrompt("can you make me a logo for my robotics club?"), "my robotics club?");
  assert.equal(extractImagePrompt("i want an image of a red fox in snow"), "a red fox in snow");
  assert.equal(extractImagePrompt("create a poster showing a futuristic cyan city"), "a futuristic cyan city");
});

test("draw and paint requests work without the word image", () => {
  assert.equal(extractImagePrompt("draw a dragon flying above a mountain"), "a dragon flying above a mountain");
  assert.equal(extractImagePrompt("paint me a watercolor garden"), "watercolor garden");
});

test("ordinary questions are not misrouted to image generation", () => {
  assert.equal(extractImagePrompt("how do image generators work?"), null);
  assert.equal(extractImagePrompt("what is the latest image model?"), null);
});

test("bare image requests receive a useful default prompt and all prompts are bounded", () => {
  assert.equal(extractImagePrompt("generate an image"), "a polished, high-quality digital illustration");
  assert.equal(extractImagePrompt("generate an image of " + "x".repeat(9_000))?.length, 8_000);
});
