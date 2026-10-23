import { Router } from "express";
import { bobModelProvider } from "../services/modelProvider.js";
import { getBobModelName } from "../services/modelNames.js";
const router = Router();
router.get("/", async (_req, res) => { const status = await bobModelProvider.status(); res.json({ model: { ...status, name: getBobModelName("bob") }, provider: "ollama" }); });
router.get("/status", async (_req, res) => { const status = await bobModelProvider.status(); res.json({ ...status, model: status.picks.chat, name: getBobModelName(status.picks.chat || "bob") }); });
export default router;
