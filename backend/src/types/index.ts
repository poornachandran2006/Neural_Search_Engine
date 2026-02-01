/**
 * Shared TypeScript interfaces for the RAG system
 */

export interface SearchResult {
    id: string;
    score: number;
    payload: {
        text: string;
        doc_id: string;
        source_file?: string;
        chunk_index: number;
        file_hash?: string;
    };
}

export interface RAGChunk {
    text: string;
    doc_id: string;
    source_file?: string;
    score: number;
}

export interface QueryResponse {
    query: string;
    scope: "current_file" | "all_files";
    answer: string;
    sources: DocumentSource[];
    debug?: DebugInfo;
}

export interface DocumentSource {
    doc_id: string;
    source_file?: string;
}

export interface DebugInfo {
    retrieval: {
        scope: string;
        topK: number;
        filters: Record<string, any>;
    };
    chunks: ChunkDebugInfo[];
}

export interface ChunkDebugInfo {
    chunk: number;
    doc_id: string;
    source_file?: string;
    score: number;
    preview: string;
}

export interface PerDocumentAnswer {
    doc_id: string;
    source_file?: string;
    answer: string;
}

// ================= QUERY INTENT ROUTING TYPES =================

/**
 * Query intent classification
 */
export type QueryIntent = 'metadata' | 'content';

/**
 * Document metadata structure
 */
export interface DocumentMetadata {
    doc_id: string;
    source_file?: string;
}

/**
 * Response for metadata queries
 */
export interface MetadataQueryResponse {
    query: string;
    intent: 'metadata';
    documents: DocumentMetadata[];
    count: number;
}

/**
 * Union type for all possible query responses
 */
export type ApiQueryResponse = QueryResponse | MetadataQueryResponse;

