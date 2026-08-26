import { Router } from "express";
import { listOfficeAgents, subscribeOffice } from "../services/agentOffice.js";

const router = Router();

router.get("/agents", (_req, res) => res.json({ agents: listOfficeAgents() }));

router.get("/events", (req, res) => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event: unknown) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  send({ type: "office.snapshot", agents: listOfficeAgents(), timestamp: new Date().toISOString() });
  const unsubscribe = subscribeOffice(send);
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15_000);
  req.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
});

export default router;
