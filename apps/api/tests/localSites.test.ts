import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const { extractHtml, readLocalSite, saveLocalSite, siteName, wantsLocalSite, localSitesEnabled } = await import("../src/services/localSites.js");

test("localhost requests are recognised and named sensibly", () => {
  assert.equal(wantsLocalSite("build me a simple calculator website on localhost"), true);
  assert.equal(wantsLocalSite("make a todo app and run it locally"), true);
  assert.equal(wantsLocalSite("build me a calculator"), false);
  assert.equal(siteName("build me a simple calculator website on localhost"), "calculator");
  assert.equal(siteName("make a quiz game app on localhost please"), "quiz-game");
  assert.equal(siteName("../../etc/passwd on localhost"), "etc-passwd");
});

test("only a complete HTML document is taken from the reply", () => {
  const page = "<!DOCTYPE html>\n<html><body><button>1</button></body></html>";
  assert.equal(extractHtml(`Here you go:\n\`\`\`html\n${page}\n\`\`\`\nPress Preview.`), page);
  assert.equal(extractHtml("```js\nconsole.log(1)\n```"), "");
  assert.equal(extractHtml("no code here"), "");
});

test("sites are saved under a free name and cannot be read outside the sites folder", async () => {
  process.env.BOBAI_SITES_DIR = await mkdtemp(path.join(tmpdir(), "jarvis-sites-"));
  try {
    const page = "<!doctype html><html><body>hi</body></html>";
    const first = await saveLocalSite(page, "build me a calculator on localhost", 3001);
    const second = await saveLocalSite(page, "build me a calculator on localhost", 3001);
    assert.equal(first.url, "http://localhost:3001/sites/calculator/");
    assert.equal(second.slug, "calculator-2");
    assert.equal(await readLocalSite("calculator"), page);
    for (const bad of ["../calculator", "..", "calculator/../../x", "CALC", ""]) assert.equal(await readLocalSite(bad), null, bad);
  } finally { delete process.env.BOBAI_SITES_DIR; }
});

test("localhost sites are never available on the hosted site", () => {
  process.env.VERCEL = "1";
  try { assert.equal(localSitesEnabled(), false); } finally { delete process.env.VERCEL; }
  assert.equal(localSitesEnabled(), true);
});

test("Jarvis only promises a localhost button where it can actually host one", async () => {
  const { buildSystemPrompt } = await import("../src/services/chatEngine.js");
  const saved = process.env.VERCEL;
  try {
    process.env.VERCEL = "1";
    const hosted = buildSystemPrompt("").content;
    assert.match(hosted, /can't start servers on their computer/);
    assert.doesNotMatch(hosted, /Open localhost button/);
    delete process.env.VERCEL;
    assert.match(buildSystemPrompt("").content, /Open localhost button/);
  } finally { if (saved === undefined) delete process.env.VERCEL; else process.env.VERCEL = saved; }
});
