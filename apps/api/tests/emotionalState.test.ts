import assert from "node:assert/strict";
import test from "node:test";
import { describeEmotionalContext, getConversationMood } from "../src/services/emotionalState.js";

test("mood ignores assistant messages and defaults to neutral", () => {
  assert.deepEqual(getConversationMood([{ role: "assistant", content: "thanks!" }]), {
    signal: "neutral",
    intensity: 0,
    context: "the recent conversation is neutral",
  });
});

test("positive user messages produce a friendly style signal", () => {
  const mood = getConversationMood([{ role: "user", content: "thanks, that was awesome" }]);
  assert.equal(mood.signal, "positive");
  assert.equal(mood.intensity, 1);
  assert.match(describeEmotionalContext([{ role: "user", content: "thank you" }]), /friendly/);
});

test("repeated hostile messages produce a mild tense signal, not a refusal", () => {
  const mood = getConversationMood([
    { role: "user", content: "you're useless" },
    { role: "user", content: "you're stupid" },
  ]);
  assert.equal(mood.signal, "frustrated");
  assert.equal(mood.intensity, 3);
  assert.match(describeEmotionalContext([{ role: "user", content: "shut up" }]), /mildly tense/);
});

test("mood uses only the latest six user messages", () => {
  const messages = [
    { role: "user", content: "you're useless" },
    ...Array.from({ length: 6 }, () => ({ role: "user", content: "hello there" })),
  ];
  assert.equal(getConversationMood(messages).signal, "neutral");
});

test("mood is bounded and treats mixed signals without escalating", () => {
  const mood = getConversationMood([
    { role: "user", content: "you're useless" },
    { role: "user", content: "you're useless" },
    { role: "user", content: "thanks" },
  ]);
  assert.equal(mood.signal, "frustrated");
  assert.ok(mood.intensity <= 3);
});
