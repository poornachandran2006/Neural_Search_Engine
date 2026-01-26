import os
import argparse

from loaders.txt_loader import TxtLoader
from loaders.pdf_loader import PdfLoader
from parsers.text_parser import TextParser
from chunking.fixed_chunker import FixedChunker
from pipelines.qdrant_writer import QdrantWriter

from embeddings.local_embedder import LocalEmbedder


# -----------------------------
# CLI Arguments
# -----------------------------
parser_cli = argparse.ArgumentParser(description="Ingest a document into Qdrant")
parser_cli.add_argument(
    "--file",
    type=str,
    required=True,
    help="Path to the document file to ingest"
)
parser_cli.add_argument(
    "--doc_id",
    type=str,
    required=True,
    help="Document ID (used for file-scoped retrieval)"
)
parser_cli.add_argument(
    "--file_hash",
    type=str,
    required=True,
    help="SHA-256 hash of the document file (used for deduplication)"
)

args = parser_cli.parse_args()

file_path = args.file
doc_id = args.doc_id
file_hash = args.file_hash

if not os.path.exists(file_path):
    raise FileNotFoundError(f"File not found: {file_path}")


# -----------------------------
# Select Loader by File Type
# -----------------------------
ext = os.path.splitext(file_path)[1].lower()

if ext == ".pdf":
    loader = PdfLoader()
elif ext == ".txt":
    loader = TxtLoader()
else:
    raise ValueError(f"Unsupported file type: {ext}")


# -----------------------------
# Embedder (FREE – Local)
# -----------------------------
embedder = LocalEmbedder()


# -----------------------------
# Pipeline
# -----------------------------
text_parser = TextParser()
chunker = FixedChunker(chunk_size=200, overlap=50)
writer = QdrantWriter()

# Load document
doc = loader.load(file_path)

# Parse & chunk
clean_text = text_parser.parse(doc["text"])
chunks = chunker.chunk(clean_text)

print(f"[DEBUG] Total chunks created: {len(chunks)}")

if not chunks:
    raise ValueError("No chunks created from document text")

# Embed (REAL semantic embeddings)
embedded_chunks = embedder.embed_chunks(chunks)

# Persist to Qdrant (doc_id + file_hash INCLUDED)
writer.upsert_chunks(
    embedded_chunks,
    doc_id=doc_id,
    source_file=os.path.basename(file_path),
    file_hash=file_hash
)

print(
    f"✅ Successfully ingested '{os.path.basename(file_path)}' "
    f"(doc_id={doc_id}, file_hash={file_hash}) using LOCAL embeddings"
)
