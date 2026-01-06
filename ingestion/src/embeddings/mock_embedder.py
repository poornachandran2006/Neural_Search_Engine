# ingestion/src/embeddings/mock_embedder.py

from typing import List, Dict
from sentence_transformers import SentenceTransformer


class MockEmbedder:
    """
    Local SentenceTransformer embedder.
    Replaces mock embeddings with real semantic embeddings.
    """

    def __init__(self, embedding_dim: int = 1536):
        self.embedding_dim = embedding_dim
        self.model = SentenceTransformer("all-MiniLM-L6-v2")

    def _normalize_embedding(self, vector: List[float]) -> List[float]:
        """
        Pad or truncate embedding to match Qdrant dimension (1536)
        """
        if len(vector) > self.embedding_dim:
            return vector[: self.embedding_dim]

        if len(vector) < self.embedding_dim:
            return vector + [0.0] * (self.embedding_dim - len(vector))

        return vector

    def embed_chunks(self, chunks: List[Dict]) -> List[Dict]:
        texts = [chunk["text"] for chunk in chunks]

        embeddings = self.model.encode(
            texts,
            convert_to_numpy=True,
            normalize_embeddings=True
        )

        enriched_chunks = []

        for chunk, emb in zip(chunks, embeddings):
            embedding = self._normalize_embedding(emb.tolist())

            enriched_chunks.append({
                **chunk,
                "embedding": embedding,
                "embedding_model": "local-all-MiniLM-L6-v2",
                "embedding_dim": self.embedding_dim,
            })

        return enriched_chunks
