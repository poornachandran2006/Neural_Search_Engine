import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { QdrantClient } from "@qdrant/js-client-rest";

const router = Router();

/* ============================
   Qdrant client
   ============================ */
const qdrant = new QdrantClient({
  url: "http://localhost:6333",
});

/* =====================================================
   In-progress upload tracker
   file_hash → doc_id
   ===================================================== */
const inProgressUploads = new Map<string, string>();

/* ============================
   Upload directory
   ============================ */
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/* ============================
   Multer configuration
   ============================ */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

/* ============================
   Utility: SHA-256 file hash
   ============================ */
function computeFileHash(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/* ============================
   Trigger ingestion (ASYNC)
   ============================ */
function triggerIngestion(
  filePath: string,
  docId: string,
  fileHash: string
) {
  const python = spawn(
    "python",
    [
      "../ingestion/src/main.py",
      "--file",
      filePath,
      "--doc_id",
      docId,
      "--file_hash",
      fileHash,
    ],
    {
      cwd: process.cwd(),
      stdio: "inherit",
    }
  );

  python.on("close", () => {
    inProgressUploads.delete(fileHash);
  });

  python.on("error", () => {
    inProgressUploads.delete(fileHash);
  });
}

/* ============================
   POST /api/upload
   ============================ */
router.post("/", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;

    // 1️⃣ Compute file hash
    const fileHash = computeFileHash(filePath);

    // 2️⃣ Short-term dedup (ingestion in progress)
    if (inProgressUploads.has(fileHash)) {
      fs.unlinkSync(filePath);

      return res.status(409).json({
        error: "File already uploaded (ingestion in progress)",
        doc_id: inProgressUploads.get(fileHash),
      });
    }

    // 3️⃣ Long-term dedup (Qdrant)
    const search = await qdrant.scroll("documents", {
      with_payload: true,
      limit: 1,
      filter: {
        must: [
          {
            key: "file_hash",
            match: { value: fileHash },
          },
        ],
      },
    });

    if (search.points.length > 0) {
      const existingDocId = search.points[0].payload?.doc_id;
      fs.unlinkSync(filePath);

      return res.status(409).json({
        error: "File already uploaded",
        doc_id: existingDocId,
      });
    }

    // 4️⃣ New upload
    const docId = randomUUID();
    inProgressUploads.set(fileHash, docId);

    // 5️⃣ Start ingestion
    triggerIngestion(filePath, docId, fileHash);

    return res.status(200).json({
      message: "File uploaded successfully. Ingestion started.",
      doc_id: docId,
    });
  } catch (err) {
    console.error("[UPLOAD ERROR]", err);
    return res.status(500).json({ error: "Upload failed" });
  }
});

/* ============================
   GET /api/upload/documents
   ============================ */
router.get("/documents", (_req: Request, res: Response) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR);

    const documents = files.map((file) => {
      const parts = file.split("-");
      const fileName = parts.slice(1).join("-");

      return {
        doc_id: parts[0],
        file_name: fileName,
      };
    });

    return res.status(200).json(documents);
  } catch (err) {
    console.error("[LIST DOCUMENTS ERROR]", err);
    return res.status(500).json({ error: "Failed to list documents" });
  }
});

/* ============================
   GET /api/upload/documents/:doc_id/download
   ============================ */
router.get(
  "/documents/:doc_id/download",
  (req: Request, res: Response) => {
    try {
      const { doc_id } = req.params;

      const files = fs.readdirSync(UPLOAD_DIR);
      const file = files.find((f) => f.startsWith(`${doc_id}-`));

      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      const filePath = path.join(UPLOAD_DIR, file);
      const originalName = file.split("-").slice(1).join("-");

      return res.download(filePath, originalName);
    } catch (err) {
      console.error("[DOWNLOAD ERROR]", err);
      return res.status(500).json({ error: "Failed to download file" });
    }
  }
);

export default router;
