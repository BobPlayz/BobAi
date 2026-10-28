/**
 * Deterministic calculator artifact for common calculator-build requests.
 * A fixed, tested implementation avoids asking a small language model to invent button wiring or arithmetic.
 */
export function isCalculatorBuildRequest(text: string): boolean {
  return /\b(?:build|make|create|code|generate)\b[\s\S]{0,60}\bcalculator\b/i.test(text) &&
    !/^\s*(?:what|how|why|when|where|which|can you explain)\b/i.test(text);
}

export function calculatorHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Calculator</title>
<style>
:root{color-scheme:dark;--bg:#10131b;--panel:#1a1f2b;--key:#282f3d;--key-hover:#343d4e;--accent:#8ba8ff;--text:#f4f6fb;--muted:#9ca8bd;--danger:#ff9c9c}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:radial-gradient(ellipse at top,#252d43 0,#10131b 65%);font:16px system-ui,-apple-system,sans-serif;color:var(--text)}
.calculator{width:min(100%,360px);padding:18px;border:1px solid #ffffff17;border-radius:24px;background:var(--panel);box-shadow:0 24px 70px #0006}
.top{display:flex;justify-content:space-between;align-items:center;margin:2px 2px 14px}.top strong{font-size:14px;letter-spacing:.08em}.hint{font-size:11px;color:var(--muted)}
.display{min-height:112px;padding:16px 12px 18px;text-align:right;display:flex;flex-direction:column;justify-content:flex-end;gap:8px;overflow:hidden;border-radius:16px;background:#0c0f16;margin-bottom:14px}
#expression{min-height:22px;color:var(--muted);overflow-wrap:anywhere;font-size:14px}#result{font-size:clamp(28px,8vw,40px);font-weight:600;overflow-wrap:anywhere;line-height:1.15}
.keys{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.key{min-width:0;min-height:56px;border:0;border-radius:14px;background:var(--key);color:var(--text);font:500 19px system-ui;cursor:pointer;transition:background .12s,transform .12s}.key:hover{background:var(--key-hover)}.key:active{transform:scale(.96)}.key:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.utility{color:var(--accent)}.operator{background:#30394b}.equals{background:var(--accent);color:#101522;font-weight:700}.zero{grid-column:span 2}.error #result{color:var(--danger)}
@media(max-width:380px){.calculator{padding:13px}.keys{gap:7px}.key{min-height:52px}}
@media(prefers-reduced-motion:reduce){.key{transition:none}}
</style>
</head>
<body>
<main class="calculator" aria-label="Calculator">
  <div class="top"><strong>CALCULATOR</strong><span class="hint">Keyboard supported</span></div>
  <section class="display" aria-live="polite" aria-atomic="true"><div id="expression"></div><div id="result">0</div></section>
  <div class="keys" id="keys">
    <button class="key utility" data-action="clear">AC</button><button class="key utility" data-action="backspace" aria-label="Backspace">⌫</button><button class="key utility" data-action="percent">%</button><button class="key operator" data-value="÷">÷</button>
    <button class="key" data-value="7">7</button><button class="key" data-value="8">8</button><button class="key" data-value="9">9</button><button class="key operator" data-value="×">×</button>
    <button class="key" data-value="4">4</button><button class="key" data-value="5">5</button><button class="key" data-value="6">6</button><button class="key operator" data-value="−">−</button>
    <button class="key" data-value="1">1</button><button class="key" data-value="2">2</button><button class="key" data-value="3">3</button><button class="key operator" data-value="+">+</button>
    <button class="key zero" data-value="0">0</button><button class="key" data-value=".">.</button><button class="key equals" data-action="equals">=</button>
  </div>
</main>
<script>
(() => {
  const expressionEl = document.getElementById('expression');
  const resultEl = document.getElementById('result');
  const panel = document.querySelector('.calculator');
  let expression = '';
  let justEvaluated = false;
  const operators = ['+','−','×','÷'];
  const show = (value, expressionText = expression) => {
    expressionEl.textContent = expressionText;
    resultEl.textContent = value;
    panel.classList.toggle('error', value === 'Cannot divide by zero' || value === 'Invalid expression');
  };
  const format = n => {
    if (!Number.isFinite(n)) throw new Error('Invalid expression');
    if (Object.is(n, -0)) n = 0;
    return String(Number(n.toPrecision(12)));
  };
  function tokenize(input) {
    const s = input.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/\s+/g,'');
    const tokens = [];
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (/\d|\./.test(ch)) {
        const start = i; let dots = 0;
        while (i < s.length && /[\d.]/.test(s[i])) { if (s[i] === '.') dots++; i++; }
        const raw = s.slice(start, i);
        if (dots > 1 || raw === '.') throw new Error('Invalid expression');
        tokens.push(Number(raw)); continue;
      }
      if ('+-*/()'.includes(ch)) { tokens.push(ch); i++; continue; }
      throw new Error('Invalid expression');
    }
    return tokens;
  }
  function calculate(input) {
    const t = tokenize(input); let i = 0;
    function primary() {
      const token = t[i++];
      if (typeof token === 'number') return token;
      if (token === '+' || token === '-') { const n = primary(); return token === '-' ? -n : n; }
      if (token === '(') { const n = addSub(); if (t[i++] !== ')') throw new Error('Invalid expression'); return n; }
      throw new Error('Invalid expression');
    }
    function mulDiv() {
      let n = primary();
      while (t[i] === '*' || t[i] === '/') {
        const op = t[i++], right = primary();
        if (op === '/' && right === 0) throw new Error('Cannot divide by zero');
        n = op === '*' ? n * right : n / right;
      }
      return n;
    }
    function addSub() {
      let n = mulDiv();
      while (t[i] === '+' || t[i] === '-') { const op = t[i++], right = mulDiv(); n = op === '+' ? n + right : n - right; }
      return n;
    }
    if (!t.length) return 0;
    const value = addSub();
    if (i !== t.length) throw new Error('Invalid expression');
    return value;
  }
  function update() {
    if (!expression) { show('0'); return; }
    try { show(format(calculate(expression))); }
    catch (e) { show(e.message === 'Cannot divide by zero' ? e.message : '…'); }
  }
  function input(value) {
    if (justEvaluated && !operators.includes(value)) expression = '';
    justEvaluated = false;
    if (/^\d$/.test(value)) {
      const last = expression.split(/[+−×÷()]/).pop();
      if (last === '0') expression = expression.slice(0, -1);
      expression += value;
    } else if (value === '.') {
      const last = expression.split(/[+−×÷()]/).pop();
      if (last.includes('.')) return;
      expression += last ? '.' : '0.';
    } else if (operators.includes(value)) {
      if (!expression && value !== '−') return;
      if (operators.includes(expression.slice(-1))) expression = expression.slice(0,-1);
      expression += value;
    } else if (value === '(') {
      expression += expression && /[\d)]$/.test(expression) ? '×(' : '(';
    } else if (value === ')') {
      if ((expression.match(/\(/g)||[]).length > (expression.match(/\)/g)||[]).length && /[\d)]$/.test(expression)) expression += ')';
      else return;
    }
    update();
  }
  function equals() {
    if (!expression) return;
    try { const old = expression; expression = format(calculate(expression)); show(expression, old + ' ='); justEvaluated = true; }
    catch (e) { show(e.message === 'Cannot divide by zero' ? e.message : 'Invalid expression'); }
  }
  function press(action, value) {
    if (value !== undefined) return input(value);
    if (action === 'clear') { expression = ''; justEvaluated = false; show('0'); }
    if (action === 'backspace') { expression = expression.slice(0,-1); justEvaluated = false; update(); }
    if (action === 'equals') equals();
    if (action === 'percent' && expression) {
      try { expression = format(calculate(expression) / 100); justEvaluated = false; update(); }
      catch { show('Invalid expression'); }
    }
  }
  document.getElementById('keys').addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    press(button.dataset.action, button.dataset.value);
  });
  document.addEventListener('keydown', event => {
    if (/^\d$/.test(event.key) || event.key === '.') { input(event.key); event.preventDefault(); }
    else if (event.key === '+') { input('+'); event.preventDefault(); }
    else if (event.key === '-') { input('−'); event.preventDefault(); }
    else if (event.key === '*') { input('×'); event.preventDefault(); }
    else if (event.key === '/') { input('÷'); event.preventDefault(); }
    else if (event.key === '(' || event.key === ')') { input(event.key); event.preventDefault(); }
    else if (event.key === 'Enter' || event.key === '=') { equals(); event.preventDefault(); }
    else if (event.key === 'Backspace') { press('backspace'); event.preventDefault(); }
    else if (event.key === 'Escape' || event.key === 'Delete') { press('clear'); event.preventDefault(); }
    else if (event.key === '%') { press('percent'); event.preventDefault(); }
  });
})();
</script>
</body>
</html>`;
}

export function calculatorCodeBlock(): string {
  return "```html\n" + calculatorHtml() + "\n```";
}
