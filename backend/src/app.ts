import express, { Request, Response } from "express";
import cors from "cors";
import { generateEmbedding } from "./services/embedding.service";
import { vectorSearch } from "./services/vector-search.service";
import queryRouter from "./api/query";
import uploadRouter from "./api/upload";

const app = express();

// --------------------------------------
// CORS (Frontend → Backend)
// --------------------------------------
app.use(
  cors({
    origin: "http://localhost:3000",
  })
);

// --------------------------------------
// Middleware
// --------------------------------------
app.use(express.json());

// --------------------------------------
// Health check
// --------------------------------------
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

// --------------------------------------
// Query API (RAG-ready)
// --------------------------------------
app.use("/api", queryRouter);

// --------------------------------------
// Upload API
// --------------------------------------
app.use("/api/upload", uploadRouter);

// --------------------------------------
// POST /api/search  (Legacy Neural Search)
// --------------------------------------
app.post("/api/search", async (req: Request, res: Response) => {
  try {
    const { query, top_k = 5 } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        error: "Query must be a non-empty string",
      });
    }

    const embedding = await generateEmbedding(query);
    const results = await vectorSearch(embedding, top_k);

    return res.status(200).json({
      query,
      top_k,
      results,
    });
  } catch (error: any) {
    console.error("Search error:", error.message);

    return res.status(500).json({
      error: "Internal search error",
    });
  }
});

export default app;
