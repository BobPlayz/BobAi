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
apiRouter.use(chatRouter);
apiRouter.use(streamRouter);
apiRouter.use(conversationsRouter);
apiRouter.use(imagesRouter);
apiRouter.use(memoryRouter);
apiRouter.use(filesRouter);
apiRouter.use(agentsRouter);
