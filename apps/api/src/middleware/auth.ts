import type { NextFunction, Request, Response } from "express";
import { authenticateAccessToken } from "../services/auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; username: string; displayName: string | null; avatarUrl: string | null; role: string };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return res.status(401).json({ error: "authentication required" });
  try {
    const user = await authenticateAccessToken(token);
    if (!user) return res.status(401).json({ error: "invalid or expired session" });
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: "invalid or expired session" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "admin access required" });
  return next();
}
