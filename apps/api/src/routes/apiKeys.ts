import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createApiKey, listApiKeys, revokeApiKey } from "../services/apiKeys.js";

const router = Router();
router.use(requireAuth);

function workspace(req: Parameters<typeof requireAuth>[0]) {
  const value = req.header("x-workspace-id");
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

router.get("/", async (req, res) => {
  const id = workspace(req);
  if (!id) return res.status(400).json({ error: "x-workspace-id required" });
  const keys = await listApiKeys(req.user!.id, id);
  return keys ? res.json({ keys }) : res.status(403).json({ error: "workspace access denied" });
});

router.post("/", async (req, res) => {
  const id = workspace(req);
  const { name, permissions, expiresAt } = req.body ?? {};
  if (!id || typeof name !== "string" || name.trim().length < 1 || name.length > 80) return res.status(400).json({ error: "invalid api key request" });
  const expiry = expiresAt ? new Date(expiresAt) : undefined;
  if (expiry && Number.isNaN(expiry.getTime())) return res.status(400).json({ error: "invalid expiry" });
  const key = await createApiKey(req.user!.id, id, name.trim(), permissions, expiry);
  return key ? res.status(201).json(key) : res.status(403).json({ error: "workspace access denied" });
});

router.delete("/:id", async (req, res) => {
  const id = workspace(req);
  if (!id) return res.status(400).json({ error: "x-workspace-id required" });
  return res.status(await revokeApiKey(req.user!.id, id, req.params.id as string) ? 204 : 404).send();
});

export default router;
