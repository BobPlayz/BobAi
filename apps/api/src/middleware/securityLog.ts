import type { NextFunction, Request, Response } from "express";

const SECURITY_STATUSES = new Set([401, 403, 404, 408, 413, 429]);

export function securityLog(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();
  res.on("finish", () => {
    const status = res.statusCode;
    if (status >= 500 || SECURITY_STATUSES.has(status)) {
      const requestId = res.getHeader("x-request-id");
      console.warn(JSON.stringify({
        type: "security_event",
        requestId: typeof requestId === "string" ? requestId : undefined,
        method: req.method,
        path: req.path,
        status,
        durationMs: Date.now() - startedAt,
      }));
    }
  });
  next();
}
