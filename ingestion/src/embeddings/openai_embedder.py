# ingestion/src/embeddings/openai_embedder.py

import os
from typing import List, Dict

from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class OpenAIEmbedder:
    """
    Generate embeddings using OpenAI Embeddings API
    """

    def __init__(self, model: str = "text-embedding-3-small"):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise EnvironmentError("OPENAI_API_KEY is not set")

        self.client = OpenAI(api_key=api_key)
        self.model = model

    def embed_chunks(self, chunks: List[Dict]) -> List[Dict]:
        """
        Generate embeddings for text chunks

        :param chunks: list of chunks with 'text'
        :return: chunks with added 'embedding'
        """
        texts = [chunk["text"] for chunk in chunks]

        response = self.client.embeddings.create(
            model=self.model,
            input=texts,
        )

        embeddings = response.data

        enriched_chunks = []
        for chunk, emb in zip(chunks, embeddings):
            enriched_chunks.append({
                **chunk,
                "embedding": emb.embedding,
                "embedding_model": self.model,
                "embedding_dim": len(emb.embedding),
            })

        return enriched_chunks
