import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { promises as fs } from "node:fs";
import { PDFParse } from "pdf-parse";

const router = Router();
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: MAX_FILE_SIZE },
});

function uploadMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
        error: error.code === "LIMIT_FILE_SIZE" ? "file exceeds the 10 MB size limit" : `upload failed: ${error.code}`,
      });
    }
    return res.status(400).json({ error: "file upload failed" });
  });
}

function isPdf(buffer: Buffer) {
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function isSupportedTextType(mimetype: string) {
  return /^text\/(plain|markdown|csv|html|css|javascript|xml)$/i.test(mimetype);
}

function safeName(name: string) {
  return name.replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g, "_").slice(0, 255);
}

router.post("/upload", uploadMiddleware, async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "no file uploaded" });

  try {
    const buffer = await fs.readFile(file.path);
    const { mimetype } = file;
    let text = "";

    if (mimetype === "application/pdf") {
      if (!isPdf(buffer)) return res.status(415).json({ error: "file content does not match PDF type" });
      const parser = new PDFParse({ data: buffer });
      try {
        const data = await parser.getText();
        text = data.text || "";
      } finally {
        await parser.destroy();
      }
    } else if (isSupportedTextType(mimetype)) {
      text = buffer.toString("utf8");
    } else if (/^image\/(png|jpeg|webp|gif)$/i.test(mimetype)) {
      text = "[image uploaded]";
    } else {
      return res.status(415).json({ error: "unsupported file type" });
    }

    return res.json({ name: safeName(file.originalname), type: mimetype, text });
  } catch {
    return res.status(500).json({ error: "failed to process file" });
  } finally {
    await fs.unlink(file.path).catch(() => undefined);
  }
});

export default router;
