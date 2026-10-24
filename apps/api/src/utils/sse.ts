import type { Response } from "express";

export function initSSE(res: Response) {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    if (res.writableEnded || res.destroyed) return;
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Keep-alive: a comment line every 15 s while Jarvis is busy (live data, tools, slow models), so proxies and
  // mobile networks don't drop a connection that looks idle. Clients ignore comment lines.
  const heartbeat = setInterval(() => { if (res.writableEnded || res.destroyed) { clearInterval(heartbeat); return; } res.write(": ping\n\n"); }, 15_000);
  heartbeat.unref?.();
  res.once("close", () => clearInterval(heartbeat));
  res.once("finish", () => clearInterval(heartbeat));

  return { send };
}
