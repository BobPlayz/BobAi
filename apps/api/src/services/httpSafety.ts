import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function privateIp(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (isIP(address) === 6) {
    const value = address.toLowerCase();
    return value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd") || /^fe[89ab]/.test(value);
  }
  return true;
}

function privateHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/[\[\]]/g, "");
  return host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "::" || host === "::1" || host === "0.0.0.0";
}

export function providerUrl(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("provider URL is invalid"); }
  const localHttp = process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname.toLowerCase());
  if (url.protocol !== "https:" && !localHttp) throw new Error("provider must use HTTPS outside local development");
  return url;
}

export function targetUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 4_000) throw new Error("target URL is invalid");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("target URL is invalid"); }
  if (url.username || url.password) throw new Error("target URL credentials are not allowed");
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("target URL protocol is not allowed");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("target URL must use HTTPS in production");
  return url;
}

export async function assertPublicTargetUrl(value: unknown) {
  const url = targetUrl(value);
  const hostname = url.hostname.replace(/[\[\]]/g, "").toLowerCase();
  if (privateHostname(hostname)) throw new Error("private target hosts are not allowed");
  if (isIP(hostname)) {
    if (privateIp(hostname)) throw new Error("private target addresses are not allowed");
    return url;
  }
  let addresses;
  try { addresses = await lookup(hostname, { all: true, verbatim: true }); } catch { throw new Error("target host could not be resolved"); }
  if (!addresses.length || addresses.some(({ address }) => privateIp(address))) throw new Error("target host resolves to a private address");
  return url;
}

export async function boundedText(response: Response, maxBytes: number) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("provider response exceeds the configured limit");
  const body = response.body;
  if (!body) {
    const text = await response.text();
    if (Buffer.byteLength(text) > maxBytes) throw new Error("provider response exceeds the configured limit");
    return text;
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("provider response exceeds the configured limit");
      }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
}

export function safeError(error: unknown) {
  const text = error instanceof Error ? error.message : "tool failed";
  return text.replace(/(Bearer\s+)[^\s,;]+/gi, "$1[redacted]").replace(/[\r\n\t]+/g, " ").slice(0, 500);
}
