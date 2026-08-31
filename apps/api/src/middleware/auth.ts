import type { NextFunction, Request, Response } from "express";
import { authenticateAccessToken } from "../services/auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; username: string; displayName: string | null; avatarUrl: string | null; role: string };
    }
  }
}

function readCookie(req: Request, name: string) {
  const header = req.header("cookie") || "";
  const item = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : "";
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : readCookie(req, "bobai_access");
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
  const allowed = (process.env.BOBAI_ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  if (allowed.length !== 2 || new Set(allowed).size !== 2 || req.user?.role !== "admin" || !req.user?.email || !allowed.includes(req.user.email.toLowerCase())) {
    return res.status(403).json({ error: "admin access required" });
  }
  return next();
}
