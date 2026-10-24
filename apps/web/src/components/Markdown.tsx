"use client";

import { Check, Code, Copy, Download, ExternalLink, Play } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Small, dependency-free Markdown renderer for model output.
 *
 * It only ever produces React elements (never raw HTML), so model text cannot inject markup or scripts.
 * Supported: fenced code blocks with highlighting and copy, headings, ordered/unordered lists, block quotes,
 * tables, horizontal rules, paragraphs, and inline code, bold, italic, strikethrough and http(s) links.
 * Streaming-safe: an unterminated ``` fence renders as an open code block.
 */

type Block =
  | { type: "code"; lang: string; code: string; closed: boolean }
  | { type: "heading"; level: number; text: string }
  | { type: "list"; ordered: boolean; start: number; items: string[] }
  | { type: "quote"; text: string }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "rule" }
  | { type: "paragraph"; text: string };

const LIST_ITEM = /^\s{0,3}(?:([-*+])|(\d{1,9})[.)])\s+(.*)$/;

function splitRow(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const fence = /^\s{0,3}(```|~~~)\s*([\w+#.-]*)/.exec(line);
    if (fence) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trimStart().startsWith(fence[1])) { code.push(lines[index]); index += 1; }
      const closed = index < lines.length;
      index += 1;
      blocks.push({ type: "code", lang: fence[2].toLowerCase(), code: code.join("\n"), closed });
      continue;
    }
    if (!line.trim()) { index += 1; continue; }
    const heading = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) { blocks.push({ type: "heading", level: heading[1].length, text: heading[2] }); index += 1; continue; }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) { blocks.push({ type: "rule" }); index += 1; continue; }
    if (line.includes("|") && index + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[index + 1])) {
      const header = splitRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) { rows.push(splitRow(lines[index])); index += 1; }
      blocks.push({ type: "table", header, rows });
      continue;
    }
    if (/^\s{0,3}>/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s{0,3}>/.test(lines[index])) { quote.push(lines[index].replace(/^\s{0,3}>\s?/, "")); index += 1; }
      blocks.push({ type: "quote", text: quote.join("\n") });
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      const ordered = Boolean(item[2]);
      const items: string[] = [];
      const start = ordered ? Number(item[2]) : 1;
      while (index < lines.length) {
        const current = LIST_ITEM.exec(lines[index]);
        if (current && Boolean(current[2]) === ordered) { items.push(current[3]); index += 1; continue; }
        // Indented continuation lines belong to the previous item.
        if (items.length && /^\s{2,}\S/.test(lines[index]) && !LIST_ITEM.test(lines[index])) { items[items.length - 1] += `\n${lines[index].trim()}`; index += 1; continue; }
        break;
      }
      blocks.push({ type: "list", ordered, start, items });
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^\s{0,3}(```|~~~|#{1,6}\s|>)/.test(lines[index]) && !LIST_ITEM.test(lines[index])) { paragraph.push(lines[index]); index += 1; }
    blocks.push({ type: "paragraph", text: paragraph.join("\n") });
  }
  return blocks;
}

function safeHref(raw: string) {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:" ? url.toString() : null;
  } catch { return null; }
}

const INLINE = /(`+)([^`]+?)\1|\*\*([^*]+?)\*\*|__([^_]+?)__|~~([^~]+?)~~|\*([^*\s][^*]*?)\*|\b_([^_\s][^_]*?)_\b|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

export function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let n = 0;
  // Fresh regex per call: renderInline recurses (bold inside links, etc.), and a shared global regex's
  // lastIndex would be reset by the inner call, looping the outer one forever.
  const pattern = new RegExp(INLINE.source, "g");
  const pushText = (value: string) => {
    const parts = value.split("\n");
    parts.forEach((part, partIndex) => { if (partIndex) nodes.push(<br key={`${keyPrefix}-br-${n++}`} />); if (part) nodes.push(part); });
  };
  while ((match = pattern.exec(text))) {
    if (match.index > last) pushText(text.slice(last, match.index));
    const key = `${keyPrefix}-${n++}`;
    if (match[2] !== undefined) nodes.push(<code key={key} className="md-inline-code">{match[2]}</code>);
    else if (match[3] !== undefined || match[4] !== undefined) nodes.push(<strong key={key}>{renderInline(match[3] ?? match[4], key)}</strong>);
    else if (match[5] !== undefined) nodes.push(<del key={key}>{renderInline(match[5], key)}</del>);
    else if (match[6] !== undefined || match[7] !== undefined) nodes.push(<em key={key}>{renderInline(match[6] ?? match[7], key)}</em>);
    else if (match[8] !== undefined) {
      const href = safeHref(match[9]);
      nodes.push(href ? <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow" className="md-link">{renderInline(match[8], key)}</a> : match[0]);
    } else if (match[10] !== undefined) {
      const href = safeHref(match[10]);
      nodes.push(href ? <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow" className="md-link">{match[10]}</a> : match[10]);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) pushText(text.slice(last));
  return nodes;
}

// --- Lightweight syntax highlighting -------------------------------------------------------------------------
const KEYWORDS: Record<string, string> = {
  js: "async await break case catch class const continue default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while yield null undefined true false interface type enum implements readonly as",
  py: "and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield self",
  sh: "if then else elif fi for while do done case esac function in export local return echo cd sudo",
  sql: "select from where insert into values update set delete create table alter drop join left right inner outer on group by order having limit as and or not null primary key references index distinct",
  go: "break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false",
  rust: "as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while",
  c: "auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while class public private protected new delete namespace template using bool true false nullptr",
  java: "abstract boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long new package private protected public return short static super switch this throw throws try void while null true false var",
};
const LANG_ALIASES: Record<string, string> = { javascript: "js", jsx: "js", ts: "js", tsx: "js", typescript: "js", mjs: "js", json: "js", python: "py", bash: "sh", shell: "sh", zsh: "sh", powershell: "sh", ps1: "sh", golang: "go", rs: "rust", cpp: "c", "c++": "c", h: "c", cs: "java", csharp: "java", kotlin: "java", kt: "java" };
const keywordSets = new Map<string, Set<string>>();
function keywordsFor(lang: string) {
  const family = KEYWORDS[lang] ? lang : LANG_ALIASES[lang];
  if (!family) return null;
  if (!keywordSets.has(family)) keywordSets.set(family, new Set(KEYWORDS[family].split(" ")));
  return { family, words: keywordSets.get(family)! };
}

const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|--[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\b(\d+(?:\.\d+)?)\b|([A-Za-z_$][\w$]*)/g;

export function highlight(code: string, lang: string): ReactNode[] {
  const config = keywordsFor(lang);
  if (!config) return [code];
  const hashComments = config.family === "py" || config.family === "sh";
  const dashComments = config.family === "sql";
  const nodes: ReactNode[] = [];
  let last = 0;
  let n = 0;
  let match: RegExpExecArray | null;
  const pattern = new RegExp(TOKEN.source, "g");
  while ((match = pattern.exec(code))) {
    const [text, comment, string, number, word] = match;
    let className = "";
    if (comment) {
      const isHash = comment.startsWith("#"), isDash = comment.startsWith("--");
      if ((isHash && !hashComments) || (isDash && !dashComments)) { pattern.lastIndex = match.index + 1; continue; }
      className = "tok-comment";
    } else if (string) className = "tok-string";
    else if (number) className = "tok-number";
    else if (word) className = config.words.has(config.family === "sql" ? word.toLowerCase() : word) ? "tok-keyword" : /^[A-Z]/.test(word) ? "tok-type" : code[match.index + word.length] === "(" ? "tok-fn" : "";
    if (!className) continue;
    if (match.index > last) nodes.push(code.slice(last, match.index));
    nodes.push(<span key={n++} className={className}>{text}</span>);
    last = match.index + text.length;
  }
  if (last < code.length) nodes.push(code.slice(last));
  return nodes;
}

const isHtmlPage = (code: string, lang: string) => lang === "html" || /^\s*(<!doctype html|<html)/i.test(code);

/** `incomplete`: the reply ended before this code block was closed, so it is shown but never run, previewed or hosted. */
function CodeBlock({ code, lang, incomplete = false }: { code: string; lang: string; incomplete?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);
  const html = isHtmlPage(code, lang) && !incomplete;
  async function copy() {
    try { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ }
  }
  // Runs the website full screen in its own tab: the sandboxed preview page, with the code in the URL fragment (never
  // sent to any server) and no link back to this tab.
  function openFull() {
    const bytes = new TextEncoder().encode(code);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const encoded = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    window.open(`/preview-frame.html#code=${encoded}`, "_blank", "noopener,noreferrer");
  }
  function download() {
    const url = URL.createObjectURL(new Blob([code], { type: "text/html" }));
    const link = document.createElement("a");
    link.href = url; link.download = "jarvis-site.html"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
  return (
    <div className="md-code">
      <div className="md-code-bar">
        <span>{lang || "code"}{incomplete && <span className="ml-2 rounded-full border border-[var(--danger)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--danger)]" title="The reply stopped before this code was finished">incomplete</span>}</span>
        <span className="flex items-center gap-1">
          {html && (
            <>
              <button type="button" onClick={() => setPreview((value) => !value)} aria-pressed={preview} className="md-code-copy">{preview ? <Code className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}<span>{preview ? "Code" : "Preview"}</span></button>
              <button type="button" onClick={openFull} className="md-code-copy" title="Run it full screen in a new tab"><ExternalLink className="h-3.5 w-3.5" aria-hidden /><span>Open</span></button>
              <button type="button" onClick={download} className="md-code-copy"><Download className="h-3.5 w-3.5" aria-hidden /><span>Download</span></button>
            </>
          )}
          <button type="button" onClick={copy} aria-label={copied ? "Copied" : "Copy code"} className="md-code-copy">
            {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </span>
      </div>
      {preview
        // Sandboxed without allow-same-origin: the page runs its own scripts but cannot reach Jarvis's cookies, storage or window.
        ? <SitePreview code={code} />
        : <pre tabIndex={0}><code>{highlight(code, lang)}</code></pre>}
    </div>
  );
}

// Runs the page in /preview-frame.html, whose own CSP header sandboxes it (no allow-same-origin) and blocks all network
// access, so the page's scripts run but cannot reach Jarvis's cookies, storage, window or the internet.
function SitePreview({ code }: { code: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source === frame.current?.contentWindow && event.data === "jarvis-preview-ready") frame.current?.contentWindow?.postMessage(code, "*");
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [code]);
  return <iframe key={code} ref={frame} title="Website preview" src="/preview-frame.html" className="block h-[440px] w-full bg-white" />;
}

/** `live`: the text is still streaming in, so an unclosed code block is just unfinished, not cut off. */
export default function Markdown({ text, live = false }: { text: string; live?: boolean }) {
  const blocks = parseBlocks(text);
  return (
    <div className="md">
      {blocks.map((block, index) => {
        const key = `b${index}`;
        switch (block.type) {
          case "code": return <CodeBlock key={key} code={block.code} lang={block.lang} incomplete={!block.closed && !live} />;
          case "heading": {
            const Tag = (`h${Math.min(block.level + 1, 6)}`) as "h2" | "h3" | "h4" | "h5" | "h6";
            return <Tag key={key} className="md-heading">{renderInline(block.text, key)}</Tag>;
          }
          case "list": {
            const items = block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `${key}-${itemIndex}`)}</li>);
            return block.ordered ? <ol key={key} start={block.start}>{items}</ol> : <ul key={key}>{items}</ul>;
          }
          case "quote": return <blockquote key={key}><Markdown text={block.text} live={live} /></blockquote>;
          case "table": return (
            <div key={key} className="md-table" tabIndex={0}>
              <table>
                <thead><tr>{block.header.map((cell, cellIndex) => <th key={cellIndex} scope="col">{renderInline(cell, `${key}-h${cellIndex}`)}</th>)}</tr></thead>
                <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{renderInline(cell, `${key}-${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          );
          case "rule": return <hr key={key} />;
          default: return <p key={key}>{renderInline(block.text, key)}</p>;
        }
      })}
    </div>
  );
}
