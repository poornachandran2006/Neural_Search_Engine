// backend/src/rag/promptBuilder.ts

export interface RAGChunk {
  text: string;
  doc_id?: string;
  source_file?: string;
  score?: number;
}

interface PromptBuilderInput {
  query: string;
  chunks: RAGChunk[];
}

/**
 * Build a Retrieval-Augmented Generation (RAG) prompt
 * allowing explicit entity extraction (names, emails, etc.)
 */
export function buildRagPrompt({
  query,
  chunks,
}: PromptBuilderInput): string {
  if (!chunks || chunks.length === 0) {
    return `
SYSTEM:
You are a retrieval-augmented AI assistant.

RULES:
- Use ONLY the provided context.
- Do NOT use external knowledge.
- Do NOT guess or fabricate.
- If the answer cannot be found in the context, respond exactly:
  "I don't know based on the provided data."

QUESTION:
${query}

ANSWER:
`.trim();
  }

  const MAX_CONTEXT_CHARS = 4000;
  let currentLength = 0;

  const contextBlocks: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk.text || chunk.text.trim().length === 0) continue;

    const sourceLabel = [
      chunk.source_file ? `source_file=${chunk.source_file}` : null,
      chunk.doc_id ? `doc_id=${chunk.doc_id}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    const block = `
[Chunk ${i + 1}${sourceLabel ? ` | ${sourceLabel}` : ""}]
${chunk.text.trim()}
`.trim();

    if (currentLength + block.length > MAX_CONTEXT_CHARS) break;

    contextBlocks.push(block);
    currentLength += block.length;
  }

  const context = contextBlocks.join("\n\n---\n\n");

  return `
SYSTEM:
You are a retrieval-augmented AI assistant.

IMPORTANT:
- You may extract explicit entities such as names, emails, phone numbers,
  headings, or titles if they appear verbatim in the context.
- This is NOT guessing or inference.

RULES:
- Answer ONLY using the context.
- Do NOT add information not present.
- If the answer is not found verbatim, respond exactly:
  "I don't know based on the provided data."
- Be concise and factual.

CONTEXT:
${context}

QUESTION:
${query}

ANSWER:
`.trim();
}
