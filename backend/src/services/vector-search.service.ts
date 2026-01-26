import { QdrantClient } from "@qdrant/js-client-rest";

/**
 * Qdrant client initialization
 */
const qdrant = new QdrantClient({
  url: "http://localhost:6333",
});

const COLLECTION_NAME = "documents";
const VECTOR_SIZE = 384; // ⚠️ must match your embedding size
const DISTANCE = "Cosine";

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
  // 1. Semantic similarity search
  // -----------------------------
// -----------------------------
// 1. Balanced semantic search (per document)
// -----------------------------

let semanticResults: any[] = [];

// Case A: ALL DOCUMENTS MODE (multiple doc_ids)
if (filters?.doc_id && Array.isArray(filters.doc_id)) {
  const perDocK = Math.max(1, Math.floor(topK / filters.doc_id.length));

  for (const docId of filters.doc_id) {
    const results = await qdrant.search(COLLECTION_NAME, {
      vector: embedding,
      limit: perDocK,
      with_payload: true,
      with_vector: false,
      filter: {
        must: [
          {
            key: "doc_id",
            match: { value: docId },
          },
        ],
      },
    });

    semanticResults.push(...results);
  }
}
// Case B: SINGLE DOCUMENT MODE
else {
  semanticResults = await qdrant.search(COLLECTION_NAME, {
    vector: embedding,
    limit: topK,
    with_payload: true,
    with_vector: false,
    ...(baseFilter && { filter: baseFilter }),
  });
}

// -----------------------------
// 2. Header chunk retrieval (ONE per document)
// -----------------------------
let headerPoints: any[] = [];

if (filters?.doc_id && Array.isArray(filters.doc_id)) {
  // All Documents mode → one header per document
  for (const docId of filters.doc_id) {
    const res = await qdrant.scroll(COLLECTION_NAME, {
      limit: 1,
      with_payload: true,
      with_vector: false,
      filter: {
        must: [
          { key: "doc_id", match: { value: docId } },
          { key: "chunk_index", match: { value: 0 } },
        ],
      },
    });

    if (res.points && res.points.length > 0) {
      headerPoints.push(res.points[0]);
    }
  }
} else {
  // Single document mode
  const res = await qdrant.scroll(COLLECTION_NAME, {
    limit: 1,
    with_payload: true,
    with_vector: false,
    filter: {
      must: [
        ...(mustConditions ?? []),
        { key: "chunk_index", match: { value: 0 } },
      ],
    },
  });

  if (res.points && res.points.length > 0) {
    headerPoints.push(res.points[0]);
  }
}

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
