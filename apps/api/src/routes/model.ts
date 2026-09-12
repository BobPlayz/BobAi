import { Router } from "express";
import { bobNativeModel } from "../services/nativeModel.js";
import { bobModelProvider } from "../services/modelProvider.js";
const router = Router();
router.get("/", async (_req, res) => res.json({ model: await bobNativeModel.status(), provider: "native" }));
router.get("/status", async (_req, res) => res.json(await bobModelProvider.status()));
export default router;
