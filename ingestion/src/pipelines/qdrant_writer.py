# ingestion/src/pipelines/qdrant_writer.py

from typing import List, Dict
from datetime import datetime
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance
import uuid


class QdrantWriter:
    """
    Write embedded chunks into Qdrant
    Ensures collection exists before upsert
    """

    def __init__(self, collection_name: str = "documents"):
        self.collection_name = collection_name
        self.client = QdrantClient(url="http://localhost:6333")
        self._ensure_collection()

    def _ensure_collection(self):
        """
        Create collection if it does not exist
        """
        collections = self.client.get_collections().collections
        exists = any(c.name == self.collection_name for c in collections)

        if not exists:
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(
                    size=1536,
                    distance=Distance.COSINE,
                ),
            )

    def upsert_chunks(
        self,
        chunks: List[Dict],
        doc_id: str,
        source_file: str,
        file_hash: str,
    ):
        """
        Upsert embedded chunks into Qdrant with deduplication metadata
        """

        if not chunks:
            raise ValueError("No chunks provided for upsert")

        points = []

        ingested_at = datetime.utcnow().isoformat()
        total_chunks = len(chunks)

        for index, chunk in enumerate(chunks):
            payload = {
                # 🔑 Deduplication metadata
                "doc_id": doc_id,
                "source_file": source_file,
                "file_hash": file_hash,

                # Tracking metadata
                "ingested_at": ingested_at,
                "chunk_index": index,
                "total_chunks": total_chunks,

                # Content
                "text": chunk.get("text", ""),
            }

            points.append(
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=chunk["embedding"],
                    payload=payload,
                )
            )

        self.client.upsert(
            collection_name=self.collection_name,
            points=points,
        )
