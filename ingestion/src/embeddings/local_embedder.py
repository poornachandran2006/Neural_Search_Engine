from sentence_transformers import SentenceTransformer


class LocalEmbedder:
    """
    Free, local semantic embedder using SentenceTransformers
    """

    def __init__(self):
        self.model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

    def embed_chunks(self, chunks):
        """
        Accepts:
          - List[str]
          - List[dict] with a 'text' field

        Returns:
          - List[dict] with { text, embedding }
        """

        if not chunks:
            return []

        # -----------------------------
        # Normalize chunks to List[str]
        # -----------------------------
        texts = []

        for chunk in chunks:
            if isinstance(chunk, str):
                texts.append(chunk)
            elif isinstance(chunk, dict) and "text" in chunk:
                texts.append(chunk["text"])
            else:
                raise TypeError(
                    f"Unsupported chunk type for embedding: {type(chunk)}"
                )

        # -----------------------------
        # Generate embeddings
        # -----------------------------
        embeddings = self.model.encode(
            texts,
            show_progress_bar=False
        )

        # -----------------------------
        # Attach embeddings
        # -----------------------------
        embedded = []
        for text, vector in zip(texts, embeddings):
            embedded.append({
                "text": text,
                "embedding": vector.tolist()
            })

        return embedded
