import assert from "node:assert/strict";
import test from "node:test";
import { calculatorCodeBlock, calculatorHtml, isCalculatorBuildRequest } from "../src/services/calculatorTemplate.js";

test("only explicit calculator build requests use the deterministic template", () => {
  assert.equal(isCalculatorBuildRequest("build me a calculator"), true);
  assert.equal(isCalculatorBuildRequest("make a calculator website"), true);
  assert.equal(isCalculatorBuildRequest("how does a calculator work?"), false);
  assert.equal(isCalculatorBuildRequest("what is the best calculator app?"), false);
});

test("calculator template contains all required controls and safe arithmetic parser", () => {
  const html = calculatorHtml();
  for (const token of ['data-action="clear"', 'data-action="backspace"', 'data-action="percent"', 'data-action="equals"', 'data-value="÷"', 'data-value="×"', 'data-value="−"', "function calculate(input)", "Cannot divide by zero", "addEventListener('keydown'"]) {
    assert.ok(html.includes(token), \`missing calculator feature: \${token}\`);
  }
  assert.doesNotMatch(html, /\beval\s*\(|new Function\s*\(/);
  assert.match(calculatorCodeBlock(), /^\x60\x60\x60html\n/);
  assert.match(calculatorCodeBlock(), /\n\x60\x60\x60$/);
});
