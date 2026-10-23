import { Router } from "express";
import { localSitesEnabled, readLocalSite } from "../services/localSites.js";

const router = Router({ strict: true });

// Serves websites Jarvis built at http://localhost:<port>/sites/<name>/ (local computer only).
router.get("/:slug", (req, res) => res.redirect(301, `${req.baseUrl}/${encodeURIComponent(String(req.params.slug))}/`));
router.get("/:slug/", async (req, res) => {
  if (!localSitesEnabled()) return res.status(404).send("Not found");
  const html = await readLocalSite(String(req.params.slug));
  if (!html) return res.status(404).type("text/plain").send("This site doesn't exist. Ask Jarvis to build it again.");
  // A sandboxed, self-contained page: its scripts run, but it gets no access to Jarvis's origin, cookies or network.
  res.setHeader("Content-Security-Policy", "sandbox allow-scripts allow-forms allow-modals; default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data:; font-src data:");
  res.setHeader("Cache-Control", "no-store");
  return res.type("html").send(html);
});

export default router;
