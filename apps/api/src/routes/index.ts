import { Router } from "express";
import { healthRouter } from "./health.js";
import { chatRouter } from "./chat.js";

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(chatRouter);