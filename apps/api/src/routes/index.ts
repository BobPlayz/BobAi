import { Router } from "express";
import { healthRouter } from "./health.js";
import chatRouter from "./chat.js";
import streamRouter from "./stream.js";
import conversationsRouter from "./conversations.js";
import imagesRouter from "./images.js";
import memoryRouter from "./memory.js";
import filesRouter from "./files.js";
import agentsRouter from "./agents.js";

function buildApiRouter() {
  const router = Router();
  router.use("/chat", chatRouter);
  router.use("/stream", streamRouter);
  router.use("/conversations", conversationsRouter);
  router.use("/images", imagesRouter);
  router.use("/memory", memoryRouter);
  router.use("/files", filesRouter);
  router.use("/agents", agentsRouter);
  return router;
}

export const apiRouter = Router();
apiRouter.use(healthRouter);
apiRouter.use(buildApiRouter());

// Keep the existing unversioned API while restoring the /v1 contract used by clients.
apiRouter.use("/v1", buildApiRouter());
