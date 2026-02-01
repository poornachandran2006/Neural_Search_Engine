import { qdrant, COLLECTION_NAME, VECTOR_SIZE, DISTANCE } from "../db/qdrant";

/**
 * Optional metadata filters for vector search
 */
export type VectorSearchFilters = {
  source_file?: string | string[];
  doc_id?: string | string[];
};

/**
 * Ensure Qdrant is reachable and collection exists
 */
async function ensureQdrantReady() {
  try {
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
  } catch (err) {
    console.error("Qdrant init failed:", err);
    throw new Error("Qdrant is not reachable or not properly initialized");
  }
}

/**
 * Build Qdrant match condition
 */
function buildMatchCondition(key: string, value: string | string[]) {
  if (Array.isArray(value)) {
    return {
      key,
      match: {
        any: value,
      },
    };
  }

  return {
    key,
    match: {
      value,
    },
  };
}

/**
 * Perform vector similarity search + header-aware retrieval
 */
export async function vectorSearch(
  embedding: number[],
  topK: number = 5,
  filters?: VectorSearchFilters,
  scoreThreshold: number = -1
) {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Embedding must be a non-empty number array");
  }

  await ensureQdrantReady();

  // -----------------------------
  // Build filter conditions
  // -----------------------------
  const mustConditions: any[] = [];

  if (filters?.source_file) {
    mustConditions.push(
      buildMatchCondition("source_file", filters.source_file)
    );
  }

  if (filters?.doc_id) {
    mustConditions.push(
      buildMatchCondition("doc_id", filters.doc_id)
    );
  }

  const baseFilter =
    mustConditions.length > 0
      ? { must: mustConditions }
      : undefined;

  // -----------------------------
  // 1. Global semantic similarity search
  // -----------------------------
  const semanticResults = await qdrant.search(COLLECTION_NAME, {
    vector: embedding,
    limit: topK,
    with_payload: true,
    with_vector: false,
    ...(baseFilter && { filter: baseFilter }),
  });


  // -----------------------------
  // 2. Header chunk retrieval
  // -----------------------------
  const headerFilter = {
    must: [
      ...(mustConditions ?? []),
      { key: "chunk_index", match: { value: 0 } },
    ],
  };

  const headerRes = await qdrant.scroll(COLLECTION_NAME, {
    limit: 100, // Get headers for all matching documents
    with_payload: true,
    with_vector: false,
    filter: headerFilter,
  });

  const headerPoints = headerRes.points || [];


  // -----------------------------
  // 3. Merge + deduplicate
  // -----------------------------
  const combined = [
    ...semanticResults,
    ...headerPoints,
  ];


  const uniqueMap = new Map<string, any>();

  for (const point of combined) {
    if (!uniqueMap.has(String(point.id))) {
      uniqueMap.set(String(point.id), point);
    }
  }

  const mergedResults = Array.from(uniqueMap.values());
  console.log(
    "RAG CONTEXT DOC COUNTS:",
    mergedResults.reduce((acc: any, p: any) => {
      const d = p.payload?.doc_id ?? "unknown";
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {})
  );

  // -----------------------------
  // 4. Score threshold filtering
  // -----------------------------
  const filteredResults =
    scoreThreshold <= 0
      ? mergedResults
      : mergedResults.filter(
        (point) => (point.score ?? 1) >= scoreThreshold
      );

  return filteredResults.map((point) => ({
    id: point.id,
    score: point.score,
    payload: point.payload,
  }));
}
