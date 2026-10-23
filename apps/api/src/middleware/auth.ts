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
  if (!item) return "";
  try {
    return decodeURIComponent(item.slice(name.length + 1));
  } catch {
    return "";
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  // An empty "Bearer " header must not hide a valid session cookie.
  const token = (header?.startsWith("Bearer ") ? header.slice(7).trim() : "") || readCookie(req, "jarvis_access");
  if (!token) return res.status(401).json({ error: "authentication required" });
  try {
    const user = await authenticateAccessToken(token);
    if (!user) return res.status(401).json({ error: "invalid or expired session" });
    req.user = user;
    return next();
  } catch (error) {
    // A database problem is not a sign-out: answering 401 here made the website drop the session on any blip.
    console.error(JSON.stringify({ event: "auth_check_failed", error: error instanceof Error ? error.message.slice(0, 200) : "unknown" }));
    return res.status(503).json({ error: "sign-in check is temporarily unavailable; try again" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const allowed = (process.env.BOBAI_ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length || new Set(allowed).size !== allowed.length || req.user?.role !== "admin" || !req.user?.email || !allowed.includes(req.user.email.toLowerCase())) {
    return res.status(403).json({ error: "admin access required" });
  }
  return next();
}
