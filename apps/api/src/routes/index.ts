import { Router } from "express";
import { healthRouter } from "./health.js";
import chatRouter from "./chat.js";
import streamRouter from "./stream.js";
import conversationsRouter from "./conversations.js";
import imagesRouter from "./images.js";
import memoryRouter from "./memory.js";
import filesRouter from "./files.js";
import agentsRouter from "./agents.js";

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use("/chat", chatRouter);
apiRouter.use("/stream", streamRouter);
apiRouter.use("/conversations", conversationsRouter);
apiRouter.use("/images", imagesRouter);
apiRouter.use("/memory", memoryRouter);
apiRouter.use("/files", filesRouter);
apiRouter.use("/agents", agentsRouter);
