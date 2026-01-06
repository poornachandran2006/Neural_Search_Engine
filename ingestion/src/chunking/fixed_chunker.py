# ingestion/src/chunking/fixed_chunker.py

from typing import List, Dict


class FixedChunker:
    """
    Fixed-size text chunker with overlap
    """

    def __init__(self, chunk_size: int = 500, overlap: int = 100):
        if overlap >= chunk_size:
            raise ValueError("overlap must be smaller than chunk_size")

        self.chunk_size = chunk_size
        self.overlap = overlap

    def chunk(self, text: str) -> List[Dict]:
        """
        Split text into overlapping chunks

        :param text: cleaned input text
        :return: list of chunks with metadata
        """
        chunks: List[Dict] = []

        if not text:
            return chunks

        start = 0
        text_length = len(text)
        chunk_index = 0

        while start < text_length:
            end = start + self.chunk_size
            chunk_text = text[start:end]

            chunks.append({
                "chunk_index": chunk_index,
                "text": chunk_text,
                "start_index": start,
                "end_index": min(end, text_length),
            })

            chunk_index += 1
            start += self.chunk_size - self.overlap

        # Add total_chunks metadata AFTER chunking
        total_chunks = len(chunks)
        for chunk in chunks:
            chunk["total_chunks"] = total_chunks

        return chunks
