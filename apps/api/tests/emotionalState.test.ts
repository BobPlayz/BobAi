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

test("gratitude produces a happy conversational tone", () => {
  const mood = getConversationMood([{ role: "user", content: "thanks, that was great" }]);
  assert.equal(mood.signal, "happy");
  assert.equal(mood.intensity, 2);
  assert.match(describeEmotionalContext([{ role: "user", content: "thank you" }]), /happy/);
});

test("excited messages are distinguished from ordinary positivity", () => {
  assert.equal(getConversationMood([{ role: "user", content: "LET'S GO, we did it!" }]).signal, "excited");
});

test("sad messages invite a gentle and supportive tone", () => {
  assert.equal(getConversationMood([{ role: "user", content: "I've had a rough day and feel lonely" }]).signal, "sad");
});

test("questions and wonder can signal curiosity", () => {
  assert.equal(getConversationMood([{ role: "user", content: "I'm curious, how does this work?" }]).signal, "curious");
});

test("jokes and casual banter can signal playfulness", () => {
  assert.equal(getConversationMood([{ role: "user", content: "bruh what lol" }]).signal, "playful");
});

test("repeated hostile messages produce a bounded frustrated signal, not a refusal", () => {
  const mood = getConversationMood([
    { role: "user", content: "you're useless" },
    { role: "user", content: "you're stupid" },
  ]);
  assert.equal(mood.signal, "frustrated");
  assert.equal(mood.intensity, 3);
  assert.match(describeEmotionalContext([{ role: "user", content: "shut up" }]), /frustrated/);
});

test("mood uses only the latest six user messages", () => {
  const messages = [
    { role: "user", content: "you're useless" },
    ...Array.from({ length: 6 }, () => ({ role: "user", content: "hello there" })),
  ];
  assert.equal(getConversationMood(messages).signal, "neutral");
});

test("recent signals outweigh older ones without unbounded escalation", () => {
  const mood = getConversationMood([
    { role: "user", content: "you're useless" },
    { role: "user", content: "you're useless" },
    { role: "user", content: "thanks" },
  ]);
  assert.equal(mood.signal, "frustrated");
  assert.ok(mood.intensity <= 3);
});
