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
   Qdrant configuration
   ============================ */
const qdrant = new QdrantClient({
  url: "http://localhost:6333",
});

const COLLECTION_NAME = "documents";
const VECTOR_SIZE = 384;
const DISTANCE = "Cosine";

/* ============================
   Ensure collection exists
   ============================ */
async function ensureCollectionExists() {
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some(
    (c) => c.name === COLLECTION_NAME
  );

  if (!exists) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: VECTOR_SIZE,
        distance: DISTANCE,
      },
    });
  }
}

/* =====================================================
   In-progress upload tracker
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
    path.join(process.cwd(), "..", "ingestion", "src", "main.py"),
    "--file",
    filePath,
    "--doc_id",
    docId,
    "--file_hash",
    fileHash,
  ],
  {
    stdio: "inherit",
  }
);


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

    // 🔒 Ensure Qdrant is ready
    await ensureCollectionExists();

    const filePath = req.file.path;

    // 1️⃣ Compute file hash
    const fileHash = computeFileHash(filePath);

    // 2️⃣ Short-term dedup (ingestion in progress)
    if (inProgressUploads.has(fileHash)) {
      fs.unlinkSync(filePath);
      return res.status(409).json({
        status: "duplicate",
        message: "File already uploaded (ingestion in progress)",
        doc_id: inProgressUploads.get(fileHash),
      });
    }

    // 3️⃣ Long-term dedup (Qdrant)
    const search = await qdrant.scroll(COLLECTION_NAME, {
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
        status: "duplicate",
        message: "File already uploaded",
        doc_id: existingDocId,
      });
    }

    // 4️⃣ New upload
    const docId = randomUUID();
    inProgressUploads.set(fileHash, docId);

    // 5️⃣ Start ingestion
    triggerIngestion(filePath, docId, fileHash);

    return res.status(200).json({
      status: "uploaded",
      message: `File uploaded successfully`,
      doc_id: docId,
    });
  } catch (err) {
    console.error("[UPLOAD ERROR]", err);
    return res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
