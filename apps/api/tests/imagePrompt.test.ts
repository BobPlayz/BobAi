import test from "node:test";
import assert from "node:assert/strict";
import { extractImagePrompt } from "../src/services/imagePrompt.js";

test("explicit image requests extract only the image subject", () => {
  assert.equal(extractImagePrompt("generate an image of a cat in a space suit"), "a cat in a space suit");
  assert.equal(extractImagePrompt("make me a logo for BobAI"), "BobAI");
  assert.equal(extractImagePrompt("can you make me a logo for my robotics club?"), "my robotics club?");
  assert.equal(extractImagePrompt("i want an image of a red fox in snow"), "a red fox in snow");
  assert.equal(extractImagePrompt("create a poster showing a futuristic cyan city"), "a futuristic cyan city");
  assert.equal(extractImagePrompt("generate an image of an apple"), "an apple");
  assert.equal(extractImagePrompt("genrate an imge of a robt in teh skyy"), "a robot in the the sky");
  assert.equal(extractImagePrompt("yo, plz cretae a pictur of a flover"), "a flower");
  assert.equal(extractImagePrompt("genrate an imge"), "a polished, high-quality digital illustration");
  assert.equal(extractImagePrompt("yo generate an image of a robot in the sky"), "a robot in the sky");
  assert.equal(extractImagePrompt("yo, generate an image of a robot in the sky"), "a robot in the sky");
  assert.equal(extractImagePrompt("hey Jarvis, generate an image of a robot in the sky"), "a robot in the sky");
});

test("casual wording, slash commands, and plural image requests route to generation", () => {
  assert.equal(extractImagePrompt("can u generate an image of a corgi"), "a corgi");
  assert.equal(extractImagePrompt("pls make me a picture of a tiny house"), "a tiny house");
  assert.equal(extractImagePrompt("could you generate images of planets"), "planets");
  assert.equal(extractImagePrompt("generate an image?"), "a polished, high-quality digital illustration");
  assert.equal(extractImagePrompt("hey, draw me a dragon"), "a dragon");
  assert.equal(extractImagePrompt("/imagine apple"), "apple");
  assert.equal(extractImagePrompt("/imagine an apple"), "an apple");
  assert.equal(extractImagePrompt("  /IMAGINE a red apple  "), "a red apple");
});

test("draw and paint requests work without the word image", () => {
  assert.equal(extractImagePrompt("draw a dragon flying above a mountain"), "a dragon flying above a mountain");
  assert.equal(extractImagePrompt("paint me a watercolor garden"), "a watercolor garden");
});

test("ordinary questions and picture-search intent are not misrouted to image generation", () => {
  assert.equal(extractImagePrompt("how do image generators work?"), null);
  assert.equal(extractImagePrompt("what is the latest image model?"), null);
  assert.equal(extractImagePrompt("pictures to help with an apple"), null);
});

test("bare image requests receive a useful default prompt and all prompts are bounded", () => {
  assert.equal(extractImagePrompt("generate an image"), "a polished, high-quality digital illustration");
  assert.equal(extractImagePrompt("generate an image of " + "x".repeat(9_000))?.length, 8_000);
});
