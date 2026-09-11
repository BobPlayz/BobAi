import type { NextFunction, Request, Response } from "express";
const MAX_JSON_BYTES = 2 * 1024 * 1024;
export function executionResultLimit(_req: Request, res: Response, next: NextFunction) {
  const original = res.json.bind(res);
  res.json = ((body: unknown) => {
    let encoded: string | undefined;
    try { encoded = JSON.stringify(body); } catch { return original({ error: "response serialization failed" }); }
    if (encoded !== undefined && Buffer.byteLength(encoded, "utf8") > MAX_JSON_BYTES) return res.status(413).send(JSON.stringify({ error: "response exceeds the 2 MB limit" }));
    return original(body);
  }) as Response["json"];
  return next();
}
