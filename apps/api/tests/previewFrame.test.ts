import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the website preview page declares no global names that generated code could clash with", async () => {
  const html = await readFile(new URL("../../web/public/preview-frame.html", import.meta.url), "utf8");
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";
  const code = script.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n").trim();
  assert.match(code, /^\(function \(\) \{[\s\S]*\}\)\(\);$/, "everything must live inside one immediately-invoked function");
});
