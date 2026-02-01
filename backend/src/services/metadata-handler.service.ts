import { qdrant, COLLECTION_NAME } from "../db/qdrant";

/**
 * Document metadata structure
 */
export interface DocumentMetadata {
    doc_id: string;
    source_file?: string;
}

/**
 * Retrieve all document metadata from Qdrant
 * 
 * This function retrieves the list of all documents in the vector database
 * WITHOUT performing vector search. It's used for metadata queries like
 * "list all documents" or "what files are uploaded".
 * 
 * Strategy:
 * - Query for chunks with chunk_index = 0 (header chunks)
 * - Each document has exactly one header chunk
 * - Extract doc_id and source_file from payloads
 * - Deduplicate to ensure unique documents
 * 
 * @returns Array of document metadata (doc_id, source_file)
 */
export async function getDocumentMetadata(): Promise<DocumentMetadata[]> {
    try {
        // Retrieve all header chunks (chunk_index = 0)
        // These represent the first chunk of each document
        const response = await qdrant.scroll(COLLECTION_NAME, {
            filter: {
                must: [
                    {
                        key: "chunk_index",
                        match: { value: 0 },
                    },
                ],
            },
            limit: 100, // Adjust based on expected number of documents
            with_payload: true,
            with_vector: false, // Don't retrieve vectors (faster, less data transfer)
        });

        if (!response.points || response.points.length === 0) {
            // console.log("[METADATA] No documents found in database");
            return [];
        }

        // console.log(`[METADATA] Found ${response.points.length} documents`);

        // Extract metadata from payloads
        const metadata: DocumentMetadata[] = response.points
            .map((point) => ({
                doc_id: point.payload?.doc_id as string,
                source_file: point.payload?.source_file as string | undefined,
            }))
            .filter((doc) => doc.doc_id); // Filter out any invalid entries

        // Deduplicate by doc_id (safety check, should already be unique)
        const uniqueMetadata = Array.from(
            new Map(metadata.map((doc) => [doc.doc_id, doc])).values()
        );

        // console.log(`[METADATA] Returning ${uniqueMetadata.length} unique documents`);

        return uniqueMetadata;
    } catch (error) {
        console.error("[METADATA] Error retrieving document metadata:", error);
        throw new Error("Failed to retrieve document metadata");
    }
}

/**
 * Get count of documents in the database
 * Convenience function for "how many documents" queries
 */
export async function getDocumentCount(): Promise<number> {
    const metadata = await getDocumentMetadata();
    return metadata.length;
}

/**
 * Check if any documents exist in the database
 */
export async function hasDocuments(): Promise<boolean> {
    const count = await getDocumentCount();
    return count > 0;
}
