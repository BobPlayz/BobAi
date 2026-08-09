import { Router } from "express";
import multer from "multer";
import { promises as fs } from "fs";
import * as pdfParse from "pdf-parse";

const router = Router();

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.post(
  "/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No file uploaded",
        });
      }

      const filePath = req.file.path;
      const fileName = req.file.originalname;
      const fileType = req.file.mimetype;

      let text = "";

      if (fileType === "application/pdf") {
        const buffer = await fs.readFile(filePath);
        const data = await pdfParse.default(buffer);
        text = data.text || "";
      } else if (fileType.startsWith("text/")) {
        text = await fs.readFile(filePath, "utf8");
      } else if (fileType.startsWith("image/")) {
        text = "[image uploaded]";
      } else {
        text = "[unsupported file type]";
      }

      await fs.unlink(filePath);

      return res.json({
        name: fileName,
        type: fileType,
        text,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        error: "Failed to process file",
      });
    }
  }
);

export default router;