"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, FileText, FileType2 } from "lucide-react";

function safeName(value: string) {
  return value.trim().replace(/[^a-z0-9 _-]/gi, "").replace(/\s+/g, "-").slice(0, 70) || "jarvis-document";
}
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zipStore(files: Array<{ name: string; data: string }>) {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  const u16 = (view: DataView, at: number, value: number) => view.setUint16(at, value, true);
  const u32 = (view: DataView, at: number, value: number) => view.setUint32(at, value, true);
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.data);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(local.buffer);
    u32(lv, 0, 0x04034b50); u16(lv, 4, 20); u16(lv, 6, 0x0800); u16(lv, 8, 0);
    u16(lv, 10, 0); u16(lv, 12, 0); u32(lv, 14, crc); u32(lv, 18, data.length); u32(lv, 22, data.length);
    u16(lv, 26, name.length); u16(lv, 28, 0); local.set(name, 30); local.set(data, 30 + name.length);
    locals.push(local);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    u32(cv, 0, 0x02014b50); u16(cv, 4, 20); u16(cv, 6, 20); u16(cv, 8, 0x0800); u16(cv, 10, 0);
    u16(cv, 12, 0); u16(cv, 14, 0); u32(cv, 16, crc); u32(cv, 20, data.length); u32(cv, 24, data.length);
    u16(cv, 28, name.length); u16(cv, 30, 0); u16(cv, 32, 0); u16(cv, 34, 0); u16(cv, 36, 0);
    u32(cv, 38, 0); u32(cv, 42, offset); central.set(name, 46); centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  u32(ev, 0, 0x06054b50); u16(ev, 4, 0); u16(ev, 6, 0); u16(ev, 8, files.length); u16(ev, 10, files.length);
  u32(ev, 12, centralSize); u32(ev, 16, offset); u16(ev, 20, 0);
  const chunks = [...locals, ...centrals, end];
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const buffer = new ArrayBuffer(totalLength);
  const output = new Uint8Array(buffer);
  let cursor = 0;
  for (const chunk of chunks) { output.set(chunk, cursor); cursor += chunk.length; }
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}
function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function makeDocx(title: string, content: string) {
  const paragraphs = content.split(/\r?\n/).map(line => line.trim() ? `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>` : "<w:p/>").join("");
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>${xmlEscape(title)}</w:t></w:r></w:p>${paragraphs}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style></w:styles>`;
  return zipStore([
    { name: "[Content_Types].xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>' },
    { name: "_rels/.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: "word/document.xml", data: document },
    { name: "word/styles.xml", data: styles },
    { name: "word/_rels/document.xml.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>' },
  ]);
}
function pdfEscape(value: string) {
  return value.normalize("NFKD").replace(/[^\x20-\x7e]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
function makePdf(title: string, content: string) {
  const wrap = (value: string, width: number) => {
    const result: string[] = [];
    for (const raw of value.split(/\r?\n/)) {
      if (!raw) { result.push(""); continue; }
      let line = "";
      for (const word of raw.split(/\s+/)) {
        if (line && (line + " " + word).length > width) { result.push(line); line = word; }
        else line = line ? line + " " + word : word;
      }
      result.push(line);
    }
    return result;
  };
  const lines = [title, "", ...wrap(content, 88)];
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += 48) pages.push(lines.slice(i, i + 48));
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => id + " 0 R").join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((page, index) => {
    const pageId = pageIds[index], streamId = pageId + 1;
    const commands = ["BT", "/F1 16 Tf", "50 790 Td", `(${pdfEscape(page[0] || title)}) Tj`, "/F1 10 Tf"];
    for (const line of page.slice(1)) commands.push("0 -15 Td", `(${pdfEscape(line)}) Tj`);
    commands.push("ET");
    const stream = commands.join("\n");
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`;
    objects[streamId] = `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`;
  });
  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 1; i < objects.length; i++) { offsets[i] = new TextEncoder().encode(output).length; output += `${i} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = new TextEncoder().encode(output).length;
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) output += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([output], { type: "application/pdf" });
}
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function DocumentsPage() {
  const [title, setTitle] = useState("Untitled document");
  const [content, setContent] = useState("");
  const [format, setFormat] = useState<"docx" | "pdf">("docx");
  const [notice, setNotice] = useState("");
  const ready = useMemo(() => Boolean(title.trim() && content.trim()), [title, content]);
  function create() {
    if (!ready) { setNotice("Add a title and some content first."); return; }
    const name = safeName(title);
    download(format === "docx" ? makeDocx(title.trim(), content) : makePdf(title.trim(), content), name + (format === "docx" ? ".docx" : ".pdf"));
    setNotice(format === "docx" ? "Word document created and downloaded." : "PDF created and downloaded.");
  }
  return <main className="min-h-screen bg-[var(--bg)] px-4 py-8 text-[var(--text)] sm:px-8"><div className="mx-auto max-w-4xl">
    <Link href="/chat" className="inline-flex items-center gap-2 text-sm text-[var(--muted)]"><ArrowLeft className="h-4 w-4"/> Back to Jarvis</Link>
    <p className="caption mt-7">JARVIS DOCUMENTS</p><h1 className="mt-1 font-display text-4xl sm:text-5xl">Create a document</h1>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Make Word-compatible DOCX files and PDFs directly in your browser. No Google account, Microsoft account, or extra API key needed. Your text stays on this device while the file is created.</p>
    <section className="mt-7 space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
      <label className="block text-sm font-medium">Document title<input value={title} onChange={event => setTitle(event.target.value)} maxLength={160} className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 outline-none focus:border-[var(--text)]"/></label>
      <label className="block text-sm font-medium">Content<textarea value={content} onChange={event => setContent(event.target.value)} rows={16} maxLength={100000} placeholder="Paste or write the content Jarvis prepared..." className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-transparent p-3 leading-6 outline-none focus:border-[var(--text)]"/></label>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setFormat("docx")} aria-pressed={format === "docx"} className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm ${format === "docx" ? "border-[var(--text)] bg-[var(--text)] text-[var(--bg)]" : "border-[var(--border)]"}`}><FileText className="h-4 w-4"/> Word (.docx)</button><button type="button" onClick={() => setFormat("pdf")} aria-pressed={format === "pdf"} className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm ${format === "pdf" ? "border-[var(--text)] bg-[var(--text)] text-[var(--bg)]" : "border-[var(--border)]"}`}><FileType2 className="h-4 w-4"/> PDF (.pdf)</button></div>
      <button type="button" onClick={create} disabled={!ready} className="btn-ink inline-flex min-h-11 w-full items-center justify-center gap-2 disabled:opacity-40"><Download className="h-4 w-4"/> Create and download {format.toUpperCase()}</button>
      {notice && <p role="status" className="text-sm text-[var(--muted)]">{notice}</p>}
    </section>
  </div></main>;
}
