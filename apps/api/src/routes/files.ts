import { Router } from "express";
import multer from "multer";
import { promises as fs } from "fs";
import { PDFParse } from "pdf-parse";

const router = Router();

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

function uploadMiddleware(req: Parameters<typeof router.post>[1], res: Parameters<typeof router.post>[2], next: Parameters<typeof router.post>[3]) {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "File exceeds the 10 MB size limit"
          : `Upload failed: ${error.code}`;
      return res.status(400).json({ error: message });
    }

    console.error("UPLOAD ERROR:", error);
    return res.status(400).json({ error: "File upload failed" });
  });
}

router.post("/upload", uploadMiddleware, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "No file uploaded",
    });
  }

  const filePath = req.file.path;
  const fileName = req.file.originalname;
  const fileType = req.file.mimetype;

  try {
    let text = "";

    if (fileType === "application/pdf") {
      const buffer = await fs.readFile(filePath);
      const parser = new PDFParse({ data: buffer });

      try {
        const data = await parser.getText();
        text = data.text || "";
      } finally {
        await parser.destroy();
      }
    } else if (fileType.startsWith("text/")) {
      text = await fs.readFile(filePath, "utf8");
    } else if (fileType.startsWith("image/")) {
      text = "[image uploaded]";
    } else {
      return res.status(415).json({
        error: "Unsupported file type",
      });
    }

    return res.json({
      name: fileName,
      type: fileType,
      text,
    });
  } catch (error) {
    console.error("FILE PROCESSING ERROR:", error);

    return res.status(500).json({
      error: "Failed to process file",
    });
  } finally {
    await fs.unlink(filePath).catch(() => undefined);
  }
});

export default router;
