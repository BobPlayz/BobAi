import { Router } from "express";
import { bobNativeModel } from "../services/nativeModel.js";
import { bobModelProvider } from "../services/modelProvider.js";
import { getBobModelName } from "../services/modelNames.js";
const router = Router();
router.get("/", async (_req, res) => { const status = await bobNativeModel.status(); res.json({ model: { ...status, name: getBobModelName("bob") }, provider: "native" }); });
router.get("/status", async (_req, res) => { const status = await bobModelProvider.status(); res.json({ ...status, name: getBobModelName(status.model || "bob") }); });
export default router;
