import { getConnectedAccessToken } from "./oauth.js";

type ActionArgs = { provider: "google" | "microsoft"; action: "search_email" | "send_email" | "create_word_document" | "create_excel_csv" | "create_onenote_page" | "create_pdf" | "save_file"; query?: string; recipient?: string; subject?: string; content?: string; filename?: string };
function safeFilename(value: string, extension: string) { const base = value.trim().replace(/\.[a-z0-9]{1,8}$/i, "").replace(/[^a-z0-9 _-]/gi, "").replace(/\s+/g, "-").slice(0, 80) || "jarvis-document"; return base + extension; }
async function requestJson(url: string, token: string, init?: RequestInit) {
  const headers = new Headers(init?.headers); headers.set("authorization", "Bearer " + token); headers.set("accept", "application/json");
  const response = await fetch(url, { ...init, headers, redirect: "error", signal: AbortSignal.timeout(25_000) });
  const raw = await response.text();
  if (!response.ok) throw new Error("Connected app request failed (" + response.status + "). Check the account permissions and try reconnecting.");
  if (raw.length > 2_000_000) throw new Error("Connected app returned too much data.");
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}
export async function runConnectedAppAction(args: ActionArgs, context: { userId: string; workspaceId: string }) {
  const token = await getConnectedAccessToken(args.provider, context.userId, context.workspaceId);
  if (args.action === "search_email") {
    const query = (args.query || "").trim();
    if (!query || query.length > 500) throw new Error("Add a specific email search query first.");
    if (args.provider === "google") {
      const list = await requestJson("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=" + encodeURIComponent(query), token);
      const ids = Array.isArray(list.messages) ? list.messages.slice(0, 10) as Array<{ id: string }> : [];
      const messages = await Promise.all(ids.map(async item => {
        const message = await requestJson("https://gmail.googleapis.com/gmail/v1/users/me/messages/" + encodeURIComponent(item.id) + "?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date", token);
        const payload = message.payload && typeof message.payload === "object" ? message.payload as Record<string, unknown> : {};
        const headers = Array.isArray(payload.headers) ? payload.headers as Array<{ name?: string; value?: string }> : [];
        return { id: item.id, subject: headers.find(h => h.name?.toLowerCase() === "subject")?.value || "(no subject)", from: headers.find(h => h.name?.toLowerCase() === "from")?.value || "", date: headers.find(h => h.name?.toLowerCase() === "date")?.value || "", snippet: message.snippet || "" };
      }));
      return { provider: "Gmail", count: messages.length, messages };
    }
    const data = await requestJson("https://graph.microsoft.com/v1.0/me/messages?$top=10&$search=" + encodeURIComponent('"' + query + '"') + "&$select=id,subject,from,receivedDateTime,bodyPreview", token);
    return { provider: "Outlook", messages: Array.isArray(data.value) ? data.value : [] };
  }
  if (args.action === "send_email") {
    const recipient = (args.recipient || "").trim();
    const subject = (args.subject || "").trim();
    const content = (args.content || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || !subject || !content || content.length > 30_000) throw new Error("A valid recipient, subject and message are required.");
    if (args.provider === "google") {
      const mime = "To: " + recipient + "\r\nSubject: " + subject.replace(/[\r\n]/g, " ") + "\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n" + content;
      await requestJson("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", token, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ raw: Buffer.from(mime, "utf8").toString("base64url") }) });
    } else {
      await requestJson("https://graph.microsoft.com/v1.0/me/sendMail", token, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: { subject, body: { contentType: "Text", content }, toRecipients: [{ emailAddress: { address: recipient } }] }, saveToSentItems: true }) });
    }
    return { sent: true, provider: args.provider === "google" ? "Gmail" : "Outlook", recipient, subject };
  }
  const content = (args.content || "").trim();
  if (args.action === "create_pdf") {
    const title = (args.subject || args.filename || "Jarvis document").trim().slice(0, 160);
    const html = "<!doctype html><html><head><meta charset=\"utf-8\"><title>" + title.replace(/[<>&"]/g, "") + "</title></head><body><h1>" + title.replace(/[<>&"]/g, "") + "</h1><pre style=\"white-space:pre-wrap;font:11pt Arial;line-height:1.5\">" + content.replace(/[<>&"]/g, ch => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[ch] || ch)) + "</pre></body></html>";
    const pdfName = safeFilename(args.filename || title, ".pdf");
    let pdf: ArrayBuffer;
    if (args.provider === "google") {
      const boundary = "jarvis_" + crypto.randomUUID().replace(/-/g, "");
      const metadata = JSON.stringify({ name: safeFilename(title, ".gdoc"), mimeType: "application/vnd.google-apps.document" });
      const multipart = Buffer.concat([Buffer.from("--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + metadata + "\r\n--" + boundary + "\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n" + html + "\r\n--" + boundary + "--")]);
      const created = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "multipart/related; boundary=" + boundary }, body: multipart, redirect: "error", signal: AbortSignal.timeout(30_000) });
      if (!created.ok) throw new Error("Google Docs could not create the source document.");
      const doc = await created.json() as { id?: string };
      if (!doc.id) throw new Error("Google Docs did not return a document ID.");
      try {
        const exported = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(doc.id) + "/export?mimeType=application%2Fpdf", { headers: { authorization: "Bearer " + token }, redirect: "error", signal: AbortSignal.timeout(30_000) });
        if (!exported.ok) throw new Error("Google Docs PDF export failed.");
        pdf = await exported.arrayBuffer();
        if (pdf.byteLength < 100 || pdf.byteLength > 15 * 1024 * 1024) throw new Error("Google Docs returned an invalid PDF size.");
      } finally {
        await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(doc.id), { method: "DELETE", headers: { authorization: "Bearer " + token }, redirect: "error", signal: AbortSignal.timeout(10_000) }).catch(() => undefined);
      }
      const boundaryPdf = "jarvis_pdf_" + crypto.randomUUID().replace(/-/g, "");
      const pdfMeta = JSON.stringify({ name: pdfName, mimeType: "application/pdf" });
      const uploadBody = Buffer.concat([Buffer.from("--" + boundaryPdf + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + pdfMeta + "\r\n--" + boundaryPdf + "\r\nContent-Type: application/pdf\r\n\r\n"), Buffer.from(pdf), Buffer.from("\r\n--" + boundaryPdf + "--")]);
      const uploaded = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "multipart/related; boundary=" + boundaryPdf }, body: uploadBody, redirect: "error", signal: AbortSignal.timeout(30_000) });
      if (!uploaded.ok) throw new Error("Google Drive could not save the generated PDF.");
      const saved = await uploaded.json() as { name?: string; webViewLink?: string };
      return { created: true, format: "PDF", name: saved.name || pdfName, webUrl: saved.webViewLink || null, provider: "Google Drive" };
    }
    const tempName = safeFilename(title, ".doc");
    const temporary = await requestJson("https://graph.microsoft.com/v1.0/me/drive/root:/" + encodeURIComponent(tempName) + ":/content", token, { method: "PUT", headers: { "content-type": "application/msword" }, body: html });
    const itemId = typeof temporary.id === "string" ? temporary.id : "";
    if (!itemId) throw new Error("Microsoft Word did not return a document ID for PDF conversion.");
    try {
      const conversion = await fetch("https://graph.microsoft.com/v1.0/me/drive/items/" + encodeURIComponent(itemId) + "/content?format=pdf", { headers: { authorization: "Bearer " + token }, redirect: "manual", signal: AbortSignal.timeout(30_000) });
      let pdfResponse = conversion;
      if (conversion.status >= 300 && conversion.status < 400) {
        const location = conversion.headers.get("location");
        if (!location || new URL(location).protocol !== "https:") throw new Error("Microsoft returned an invalid PDF download link.");
        pdfResponse = await fetch(location, { redirect: "error", signal: AbortSignal.timeout(30_000) });
      }
      if (!pdfResponse.ok) throw new Error("Microsoft Word could not export this document as PDF.");
      pdf = await pdfResponse.arrayBuffer();
      if (pdf.byteLength < 100 || pdf.byteLength > 15 * 1024 * 1024) throw new Error("Microsoft Word returned an invalid PDF size.");
    } finally {
      await fetch("https://graph.microsoft.com/v1.0/me/drive/items/" + encodeURIComponent(itemId), { method: "DELETE", headers: { authorization: "Bearer " + token }, redirect: "error", signal: AbortSignal.timeout(10_000) }).catch(() => undefined);
    }
    const saved = await fetch("https://graph.microsoft.com/v1.0/me/drive/root:/" + encodeURIComponent(pdfName) + ":/content", { method: "PUT", headers: { authorization: "Bearer " + token, "content-type": "application/pdf" }, body: Buffer.from(pdf), redirect: "error", signal: AbortSignal.timeout(30_000) });
    if (!saved.ok) throw new Error("OneDrive could not save the generated PDF.");
    const item = await saved.json() as { name?: string; webUrl?: string };
    return { created: true, format: "PDF", name: item.name || pdfName, webUrl: item.webUrl || null, provider: "OneDrive" };
  }
  if (args.provider !== "microsoft") throw new Error("This document action requires a connected Microsoft 365 account.");
  const filename = safeFilename(args.filename || args.subject || "Jarvis document", args.action === "create_word_document" ? ".doc" : args.action === "create_excel_csv" ? ".csv" : args.action === "create_onenote_page" ? ".html" : ".txt");
  if (!content || content.length > 100_000) throw new Error("Document content is required and must be under 100,000 characters.");
  if (args.action === "create_onenote_page") {
    const html = "<html><head><title>" + (args.subject || filename).replace(/[<>&"]/g, "") + "</title></head><body><h1>" + (args.subject || filename).replace(/[<>&"]/g, "") + "</h1><pre>" + content.replace(/[<>&"]/g, ch => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[ch] || ch)) + "</pre></body></html>";
    await requestJson("https://graph.microsoft.com/v1.0/me/onenote/pages", token, { method: "POST", headers: { "content-type": "text/html" }, body: html });
    return { created: true, app: "OneNote", title: filename };
  }
  const mime = args.action === "create_word_document" ? "application/msword" : args.action === "create_excel_csv" ? "text/csv" : "text/plain";
  const body = args.action === "create_word_document" ? "<html><head><meta charset=\"utf-8\"></head><body><h1>" + (args.subject || filename).replace(/[<>&"]/g, "") + "</h1><pre>" + content.replace(/[<>&"]/g, ch => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[ch] || ch)) + "</pre></body></html>" : content;
  const uploaded = await requestJson("https://graph.microsoft.com/v1.0/me/drive/root:/" + encodeURIComponent(filename) + ":/content", token, { method: "PUT", headers: { "content-type": mime }, body });
  return { created: true, app: args.action === "create_word_document" ? "Word-compatible document" : args.action === "create_excel_csv" ? "Excel-compatible CSV" : "OneDrive file", name: uploaded.name || filename, webUrl: uploaded.webUrl || null };
}
