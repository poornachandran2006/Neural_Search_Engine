// backend/src/rag/mockLlm.ts

import { RAGChunk } from "./promptBuilder";

/**
 * Simple query-aware mock LLM
 * Extracts relevant sentences instead of blind slicing
 */
export function generateMockAnswer(
  query: string,
  chunks: RAGChunk[]
): string {
  if (!chunks || chunks.length === 0) {
    return "I don't know based on the provided data.";
  }

  const queryTerms = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  const sentences: string[] = [];

  for (const chunk of chunks) {
    const split = chunk.text
      .split(/[\.\n]/)
      .map(s => s.trim())
      .filter(Boolean);

    for (const sentence of split) {
      const lower = sentence.toLowerCase();
      if (queryTerms.some(term => lower.includes(term))) {
        sentences.push(sentence);
      }
    }
  }

  if (sentences.length === 0) {
    return "I don't know based on the provided data.";
  }

  // Deduplicate & limit
  const unique = Array.from(new Set(sentences)).slice(0, 5);

  return unique.join(". ") + ".";
}
