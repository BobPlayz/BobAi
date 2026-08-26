import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { healthRouter } from "./health.js";
import authRouter from "./auth.js";
import chatRouter from "./chat.js";
import streamRouter from "./stream.js";
import conversationsRouter from "./conversations.js";
import imagesRouter from "./images.js";
import memoryRouter from "./memory.js";
import filesRouter from "./files.js";
import agentsRouter from "./agents.js";
import automationRouter from "./automation.js";
import agentOfficeRouter from "./agentOffice.js";

function buildApiRouter() {
  const router = Router();
  router.use(requireAuth);
  router.use("/chat", chatRouter);
  router.use("/stream", streamRouter);
  router.use("/conversations", conversationsRouter);
  router.use("/images", imagesRouter);
  router.use("/memory", memoryRouter);
  router.use("/files", filesRouter);
  router.use("/agents", agentsRouter);
  router.use("/automation", automationRouter);
  router.use("/agent-office", agentOfficeRouter);
  return router;
}

export const apiRouter = Router();
apiRouter.use(healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use(buildApiRouter());
apiRouter.use("/v1", buildApiRouter());
