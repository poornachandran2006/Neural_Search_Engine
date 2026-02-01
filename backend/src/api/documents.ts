import { Router, Request, Response } from "express";
import { getDocumentMetadata } from "../services/metadata-handler.service";

const router = Router();

/**
 * GET /api/documents
 * Retrieves a list of all documents stored in the Qdrant vector database.
 * Used to populate the "Select Document" dropdown in the frontend.
 */
router.get("/", async (_req: Request, res: Response) => {
    try {
        const documents = await getDocumentMetadata();

        return res.status(200).json({
            documents: documents.map(doc => ({
                docId: doc.doc_id,
                fileName: doc.source_file || "Unknown File"
            })),
            count: documents.length
        });
    } catch (error: any) {
        console.error("Error fetching documents:", error);
        return res.status(500).json({
            error: "Failed to fetch document list"
        });
    }
});

export default router;
