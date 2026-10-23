import type { NextFunction, Request, Response } from "express";
const MAX_JSON_BYTES = 2 * 1024 * 1024;
// Spoken replies carry audio. Vercel caps a function response at 4.5 MB; on a PC, Piper's WAV files are bigger.
const MAX_VOICE_JSON_BYTES = process.env.VERCEL === "1" ? 4 * 1024 * 1024 : 16 * 1024 * 1024;
export function executionResultLimit(req: Request, res: Response, next: NextFunction) {
  const limit = req.path.startsWith("/voice/") ? MAX_VOICE_JSON_BYTES : MAX_JSON_BYTES;
  const original = res.json.bind(res);
  res.json = ((body: unknown) => {
    let encoded: string | undefined;
    try { encoded = JSON.stringify(body); } catch { return original({ error: "response serialization failed" }); }
    if (encoded !== undefined && Buffer.byteLength(encoded, "utf8") > limit) return res.status(413).send(JSON.stringify({ error: `response exceeds the ${Math.round(limit / 1024 / 1024)} MB limit` }));
    return original(body);
  }) as Response["json"];
  return next();
}
