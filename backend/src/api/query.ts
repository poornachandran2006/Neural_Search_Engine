import { Router, Request, Response } from "express";
import { generateEmbedding } from "../services/embedding.service";
import { vectorSearch } from "../services/vector-search.service";
import { generateLLMAnswer, mergeLLMAnswers } from "../rag/llm";
import { detectQueryIntent } from "../services/intent-detector.service";
import { getDocumentMetadata } from "../services/metadata-handler.service";
import { ENV } from "../config/env";
import {
  FALLBACK_PHRASES,
  INVALID_NAME_PATTERNS,
  isAnswerNotFound,
} from "../config/constants";
import type {
  SearchResult,
  RAGChunk,
  QueryResponse,
  DocumentSource,
  MetadataQueryResponse,
} from "../types";

const router = Router();

/* ================= NORMALIZATION ================= */

function normalizeQuery(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/**
 * POST /api/query
 */
router.post("/query", async (req: Request, res: Response) => {
  try {
    let {
      query,
      scope = "all_files",
      doc_id,
      topK = ENV.DEFAULT_TOP_K,
      debug = false,
      filters = {},
    } = req.body;

    // 🔒 Disable debug in production
    if (ENV.NODE_ENV === "production") {
      debug = false;
    }

    // -----------------------------
    // Normalize & validate query
    // -----------------------------
    if (typeof query !== "string") {
      return res.status(400).json({
        error: "Query text is required",
      });
    }

    const normalizedQuery = normalizeQuery(query);

    if (normalizedQuery.length === 0) {
      return res.status(400).json({
        error: "Query text cannot be empty",
      });
    }

    // ========================================
    // 🔀 QUERY INTENT ROUTING LAYER
    // ========================================
    // Detect if this is a metadata query (e.g., "list all documents")
    // If so, bypass vector search and LLM entirely
    const intent = detectQueryIntent(normalizedQuery);

    if (intent === 'metadata') {
      // console.log(`[METADATA QUERY] "${normalizedQuery}"`);

      try {
        // Retrieve document metadata directly from Qdrant
        // No embedding generation, no vector search, no LLM
        const documents = await getDocumentMetadata();

        const response: MetadataQueryResponse = {
          query: normalizedQuery,
          intent: 'metadata',
          documents,
          count: documents.length,
        };

        // console.log(`[METADATA QUERY] Returning ${documents.length} documents`);
        return res.json(response);
      } catch (error) {
        console.error("[METADATA QUERY] Error:", error);
        return res.status(500).json({
          error: "Failed to retrieve document metadata",
        });
      }
    }

    // If we reach here, it's a content query - continue with RAG pipeline
    console.log(`[CONTENT QUERY] "${normalizedQuery}"`);

    // -----------------------------
    // Scope validation
    // -----------------------------
    if (scope !== "current_file" && scope !== "all_files") {
      return res.status(400).json({
        error: "Invalid scope. Must be 'current_file' or 'all_files'",
      });
    }

    if (scope === "current_file") {
      if (!doc_id || typeof doc_id !== "string" || doc_id.trim().length === 0) {
        return res.status(400).json({
          error: "doc_id is required when scope is 'current_file'",
        });
      }
    }

    // -----------------------------
    // Clamp topK safely
    // -----------------------------
    if (typeof topK !== "number" || isNaN(topK)) {
      topK = ENV.DEFAULT_TOP_K;
    }
    topK = Math.max(1, Math.min(topK, ENV.MAX_CONTEXT_CHUNKS));

    // -----------------------------
    // Scope-safe filters (backend authoritative)
    // -----------------------------
    let finalFilters: Record<string, any> = {};

    if (filters && typeof filters === "object") {
      finalFilters = { ...filters };
    }

    if (scope === "current_file") {
      finalFilters.doc_id = doc_id;
    } else {
      delete finalFilters.doc_id;
    }

    console.log(
      `[QUERY] scope=${scope} doc_id=${doc_id ?? "N/A"} q="${normalizedQuery}"`
    );

    // 1️⃣ Generate embedding
    const embedding = await generateEmbedding(normalizedQuery);

    // 2️⃣ Vector search with balanced retrieval for all_files mode
    let searchResults;

    if (scope === "all_files") {
      // For all_files mode, ensure we get chunks from ALL documents
      // First, get all unique doc_ids
      const allDocsResponse = await vectorSearch(embedding, 100, {}); // Get many chunks
      const uniqueDocIds = Array.from(
        new Set(allDocsResponse.map((r: any) => r.payload?.doc_id).filter(Boolean))
      );

      console.log(`[ALL_FILES] Found ${uniqueDocIds.length} unique documents in database`);

      if (uniqueDocIds.length > 0) {
        // Get top chunks from each document to ensure balanced representation
        const perDocK = Math.max(2, Math.floor(topK / uniqueDocIds.length));
        const allChunks: any[] = [];

        for (const docId of uniqueDocIds) {
          const docChunks = await vectorSearch(
            embedding,
            perDocK,
            { doc_id: docId }
          );
          allChunks.push(...docChunks);
        }

        // Sort by score and take top-K overall
        searchResults = allChunks
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .slice(0, topK * 2); // Get more chunks for Map-Reduce

        console.log(`[ALL_FILES] Retrieved ${searchResults.length} chunks from ${uniqueDocIds.length} documents`);
      } else {
        searchResults = [];
      }
    } else {
      // For current_file mode, use normal retrieval
      searchResults = await vectorSearch(
        embedding,
        topK,
        finalFilters
      );
    }

    if (!searchResults || searchResults.length === 0) {
      return res.json({
        query: normalizedQuery,
        scope,
        answer: "The uploaded documents do not contain this information.",
        sources: [],
      });
    }

    // -----------------------------
    // Minimum retrieval safety
    // -----------------------------
    const MIN_SCORE = ENV.MIN_RETRIEVAL_SCORE ?? 0.15;

    const safeResults = searchResults.filter(
      (r: any) => typeof r.score === "number" && r.score >= MIN_SCORE
    );

    if (safeResults.length === 0) {
      return res.json({
        query: normalizedQuery,
        scope,
        answer: "The uploaded documents do not contain this information.",
        sources: [],
      });
    }

    // 3️⃣ Order chunks by (doc_id, chunk_index) to maintain document coherence
    const orderedChunks = safeResults
      .sort((a: SearchResult, b: SearchResult) => {
        // First sort by doc_id to keep documents together
        const docCompare = (a.payload?.doc_id || "").localeCompare(
          b.payload?.doc_id || ""
        );
        if (docCompare !== 0) return docCompare;
        // Then by chunk_index within each document
        return (
          (a.payload?.chunk_index ?? 0) - (b.payload?.chunk_index ?? 0)
        );
      })
      .slice(0, topK);

    const ragChunks: RAGChunk[] = orderedChunks.map((item) => ({
      text: item.payload?.text || "",
      doc_id: item.payload?.doc_id,
      source_file: item.payload?.source_file,
      score: item.score,
    }));

    if (ragChunks.length === 0) {
      return res.json({
        query: normalizedQuery,
        scope,
        answer:
          "No relevant content was found in the uploaded documents.",
        sources: [],
      });
    }

    // -----------------------------
    // Verify doc_id exists (current_file)
    // -----------------------------
    if (scope === "current_file") {
      const hasMatchingDoc = ragChunks.some(
        (c) => c.doc_id === doc_id
      );

      if (!hasMatchingDoc) {
        return res.status(400).json({
          error: "Invalid document selection. Document not found.",
        });
      }
    }


    // -----------------------------
    // Map-Reduce RAG Architecture
    // -----------------------------

    // Group chunks by doc_id
    const chunksByDoc = new Map<string, typeof ragChunks>();
    ragChunks.forEach((chunk) => {
      const docId = chunk.doc_id || "unknown";
      if (!chunksByDoc.has(docId)) {
        chunksByDoc.set(docId, []);
      }
      chunksByDoc.get(docId)!.push(chunk);
    });

    const uniqueDocIds = Array.from(chunksByDoc.keys());

    let answer: string;

    // ========================================
    // HARD-ENFORCED MAP-REDUCE RAG
    // ========================================
    // Decision: Use Map-Reduce only for multi-document queries
    if (scope === "all_files" && uniqueDocIds.length > 1) {
      console.log(`[MAP-REDUCE] Processing ${uniqueDocIds.length} documents`);
      console.log(`[MAP-REDUCE] Documents: ${uniqueDocIds.map(id => chunksByDoc.get(id)![0]?.source_file || id).join(', ')}`);

      // ========================================
      // MAP PHASE: HARD ENFORCED
      // One LLM call per document (guaranteed)
      // ========================================
      const perDocPromises = uniqueDocIds.map(async (docId) => {
        const docChunks = chunksByDoc.get(docId)!;

        console.log(`[MAP] Processing doc: ${docId} (${docChunks[0]?.source_file || 'unknown'}), chunks: ${docChunks.length}`);

        // MANDATORY LLM call for this document
        const docAnswer = await generateLLMAnswer(normalizedQuery, docChunks);

        console.log(`[MAP] Completed doc: ${docId}, answer length: ${docAnswer?.length || 0} chars`);

        return {
          doc_id: docId,
          source_file: docChunks[0]?.source_file || "Unknown",
          answer: docAnswer,
          chunk_count: docChunks.length
        };
      });

      // Wait for ALL MAP phase calls to complete
      const perDocAnswers = await Promise.all(perDocPromises);

      console.log(`[MAP] Completed ${perDocAnswers.length} LLM calls`);

      // ========================================
      // VALIDATION: Log warnings but DON'T filter
      // All answers pass to REDUCE phase
      // ========================================
      perDocAnswers.forEach((item, index) => {
        const preview = item.answer.substring(0, 100).replace(/\n/g, ' ');
        console.log(`[MAP] Doc ${index + 1} (${item.source_file}): "${preview}..."`);

        if (!item.answer || item.answer.trim().length === 0) {
          console.warn(`[MAP] ⚠️ Empty answer from ${item.doc_id}`);
        } else if (isAnswerNotFound(item.answer)) {
          console.warn(`[MAP] ⚠️ "Not found" answer from ${item.doc_id}`);
        }
      });

      // ========================================
      // REDUCE PHASE: HARD ENFORCED
      // Pass ALL answers to merge (no filtering)
      // ========================================
      console.log(`[REDUCE] Received ${perDocAnswers.length} per-document answers`);

      // Check if ALL answers are "not found"
      const allNotFound = perDocAnswers.every(item =>
        !item.answer || isAnswerNotFound(item.answer)
      );

      if (allNotFound) {
        console.log(`[REDUCE] All ${perDocAnswers.length} documents returned "not found"`);
        answer = "The uploaded documents do not contain this information.";
      } else {
        // Count how many documents have real answers
        const realAnswers = perDocAnswers.filter(item =>
          item.answer && !isAnswerNotFound(item.answer)
        );

        console.log(`[REDUCE] Real answers: ${realAnswers.length}/${perDocAnswers.length}`);

        if (realAnswers.length === 1) {
          console.log(`[REDUCE] Only 1 document has answer, returning directly`);
          answer = realAnswers[0].answer;
        } else {
          // MANDATORY MERGE: Pass ALL per-document answers (including "not found" ones)
          // The merge LLM will intelligently handle which to include
          console.log(`[REDUCE] Merging ALL ${perDocAnswers.length} answers`);
          answer = await mergeLLMAnswers(normalizedQuery, perDocAnswers);
          console.log(`[REDUCE] Merged answer length: ${answer?.length || 0} chars`);
        }
      }
    } else {
      // Single document or current_file scope - use original single-pass logic
      console.log(`[SINGLE-PASS] Processing single document query`);
      answer = await generateLLMAnswer(normalizedQuery, ragChunks);
    }

    // Existing fallback logic
    if (!answer || answer.trim().length === 0) {
      return res.json({
        query: normalizedQuery,
        scope,
        answer:
          "The uploaded documents do not contain this information.",
        sources: [],
      });
    }

    // 🔧 Deterministic fallback for resume name extraction
    if (isAnswerNotFound(answer)) {
      const candidateText = ragChunks
        .slice(0, 2)
        .map((c) => c.text)
        .join("\n");

      const nameMatch = candidateText.match(
        /\b([A-Z]{2,}(?:\s+[A-Z]{1,2}){1,3})\b/
      );

      if (nameMatch && !INVALID_NAME_PATTERNS.includes(nameMatch[0] as any)) {
        answer = `The name of the person in the resume is ${nameMatch[0].trim()}.`;
      }
    }


    if (!answer || answer.trim().length === 0) {
      return res.json({
        query: normalizedQuery,
        scope,
        answer: "The uploaded documents do not contain this information.",
        sources: [],
      });
    }

    // 5️⃣ Deduplicate sources
    const sourcesMap = new Map<string, DocumentSource>();

    ragChunks.forEach((chunk) => {
      if (!chunk.doc_id && !chunk.source_file) return;

      const key = `${chunk.doc_id || "unknown"}|${chunk.source_file || "unknown"}`;

      if (!sourcesMap.has(key)) {
        sourcesMap.set(key, {
          doc_id: chunk.doc_id,
          source_file: chunk.source_file,
        });
      }
    });

    const sources: DocumentSource[] = Array.from(sourcesMap.values());

    // -----------------------------
    // Document-aware answer prefix (only for single-pass)
    // -----------------------------
    const usedMapReduce = scope === "all_files" && uniqueDocIds.length > 1;

    if (!usedMapReduce && sources.length > 0) {
      const documentLabels = sources
        .map((s) => s.source_file || s.doc_id)
        .filter((v): v is string => typeof v === "string");

      if (documentLabels.length > 0) {
        const uniqueDocs = Array.from(new Set(documentLabels));
        answer = `Answering from: ${uniqueDocs.join(", ")}\n\n${answer}`;
      }
    }

    const response: QueryResponse = {
      query: normalizedQuery,
      scope,
      answer,
      sources,
    };

    // 6️⃣ Debug info (safe)
    if (debug && ENV.NODE_ENV !== "production") {
      response.debug = {
        retrieval: {
          scope,
          topK,
          filters: finalFilters,
        },
        chunks: ragChunks.map((c, index) => ({
          chunk: index + 1,
          doc_id: c.doc_id,
          source_file: c.source_file,
          score: c.score,
          preview: c.text.slice(0, 200),
        })),
      };
    }

    return res.json(response);
  } catch (error) {
    console.error("Query API error:", error);
    return res.status(500).json({
      error: "Failed to process query",
    });
  }
});

export default router;
