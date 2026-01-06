// backend/src/services/embedding.service.ts

import { pipeline } from "@xenova/transformers";

// ✅ MUST match Qdrant collection size
const EMBEDDING_DIMENSION = 384;

// Lazy-loaded embedding pipeline
let embedder: any = null;

async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
  }
  return embedder;
}

/**
 * Generate embedding using local transformer (FREE, 384-dim)
 */
export async function generateEmbedding(
  text: string
): Promise<number[]> {
  if (!text || typeof text !== "string") {
    throw new Error("Text must be a non-empty string for embedding");
  }

  const extractor = await getEmbedder();

  const output = await extractor(text, {
    pooling: "mean",
    normalize: true,
  });

  const vector = Array.from(output.data) as number[];

  // 🔒 SAFETY: Ensure correct dimension
  if (vector.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSION}, got ${vector.length}`
    );
  }

  return vector;
}
