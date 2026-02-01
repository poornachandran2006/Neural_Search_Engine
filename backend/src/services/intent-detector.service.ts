/**
 * Query Intent Detection Service
 * 
 * Determines whether a query is asking for metadata (document list, file names, etc.)
 * or actual content from documents.
 * 
 * Uses deterministic pattern matching (regex) for:
 * - Fast execution (no LLM calls)
 * - Predictable behavior
 * - Easy testing and maintenance
 */

export type QueryIntent = 'metadata' | 'content';

/**
 * Regex patterns that indicate a metadata query
 * These patterns match queries asking about the documents themselves,
 * not their content.
 */
const METADATA_PATTERNS = [
    // "list all documents", "show files", "display PDFs"
    /\b(list|show|display|get)\s+(all\s+)?(documents?|files?|pdfs?)\b/i,

    // "what files are uploaded", "what documents are available"
    /\bwhat\s+(documents?|files?|pdfs?)\s+(are|were|have been)?\s*(uploaded|available|present|here)\b/i,

    // "how many documents", "how many files do I have"
    /\bhow\s+many\s+(documents?|files?|pdfs?)\b/i,

    // "document names", "file titles", "file list"
    /\b(document|file)\s+(names?|titles?|list)\b/i,

    // "all uploaded files", "all available documents"
    /\ball\s+(uploaded|available)\s+(documents?|files?)\b/i,

    // "show me the files", "give me the document list"
    /\b(show|give)\s+me\s+(the\s+)?(documents?|files?|document\s+list|file\s+list)\b/i,

    // "which documents", "which files"
    /\bwhich\s+(documents?|files?|pdfs?)\b/i,
];

/**
 * Detect the intent of a user query
 * 
 * @param query - The user's query string
 * @returns 'metadata' if asking about document metadata, 'content' otherwise
 * 
 * Design principle: Fail-safe
 * - If uncertain, return 'content' (safer to do unnecessary RAG than miss a content query)
 * - Only return 'metadata' when confident the query is about document metadata
 */
export function detectQueryIntent(query: string): QueryIntent {
    if (!query || typeof query !== 'string') {
        return 'content';
    }

    const normalized = query.trim().toLowerCase();

    // Empty query defaults to content
    if (normalized.length === 0) {
        return 'content';
    }

    // Check if query matches any metadata pattern
    for (const pattern of METADATA_PATTERNS) {
        if (pattern.test(normalized)) {
            console.log(`[INTENT] Detected metadata query: "${query}"`);
            return 'metadata';
        }
    }

    // Default: treat as content query (fail-safe)
    console.log(`[INTENT] Detected content query: "${query}"`);
    return 'content';
}

/**
 * Check if a query is asking for metadata
 * Convenience function for readability
 */
export function isMetadataQuery(query: string): boolean {
    return detectQueryIntent(query) === 'metadata';
}

/**
 * Check if a query is asking for content
 * Convenience function for readability
 */
export function isContentQuery(query: string): boolean {
    return detectQueryIntent(query) === 'content';
}
