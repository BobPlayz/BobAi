import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAdmin);

router.get("/me", (req, res) => res.json({ user: req.user }));

export default router;
