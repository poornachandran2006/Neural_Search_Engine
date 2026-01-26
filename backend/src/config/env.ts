/**
 * Centralized environment configuration
 * All env access MUST go through this file
 */

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const ENV = {
  // ----------------------------
  // Server
  // ----------------------------
  PORT: parseInt(getEnv("PORT", "5000"), 10),
  NODE_ENV: getEnv("NODE_ENV", "development"),

  // ----------------------------
  // Embeddings
  // ----------------------------
  EMBEDDING_PROVIDER: getEnv("EMBEDDING_PROVIDER", "mock"),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",

  // ----------------------------
  // Vector DB
  // ----------------------------
  QDRANT_URL: getEnv("QDRANT_URL", "http://localhost:6333"),
  QDRANT_COLLECTION: getEnv("QDRANT_COLLECTION", "documents"),

  // ----------------------------
  // Retrieval
  // ----------------------------
  DEFAULT_TOP_K: parseInt(getEnv("DEFAULT_TOP_K", "5"), 10),

  // Existing threshold (kept for backward compatibility)
  DEFAULT_SCORE_THRESHOLD: parseFloat(
    getEnv("DEFAULT_SCORE_THRESHOLD", "0.15")
  ),

  // ✅ NEW — used by backend safety checks (Step 3)
  MIN_RETRIEVAL_SCORE: parseFloat(
    getEnv("MIN_RETRIEVAL_SCORE", "0.15")
  ),

  MAX_CONTEXT_CHUNKS: parseInt(
    getEnv("MAX_CONTEXT_CHUNKS", "8"),
    10
  ),

  // ----------------------------
  // File-aware RAG (Day 20)
  // ----------------------------
  // Holds the most recently uploaded document ID
  // Used when scope === "current_file"
  LAST_UPLOADED_DOC_ID: process.env.LAST_UPLOADED_DOC_ID || "",

  // ----------------------------
  // Debug
  // ----------------------------
  ENABLE_DEBUG: getEnv("ENABLE_DEBUG", "true") === "true",
};
