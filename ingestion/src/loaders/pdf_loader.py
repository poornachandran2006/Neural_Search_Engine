from pypdf import PdfReader
import re


class PdfLoader:
    """
    Robust PDF loader for resumes and documents.
    Preserves headers (like names) and normalizes text
    for better chunking and retrieval.
    """

    def load(self, file_path: str) -> dict:
        reader = PdfReader(file_path)

        pages_text = []

        for i, page in enumerate(reader.pages):
            raw_text = page.extract_text()

            if not raw_text:
                continue

            # Normalize whitespace
            text = re.sub(r"\s+", " ", raw_text).strip()

            # Explicit page boundary (important for retrieval)
            page_block = f"\n\n--- PAGE {i + 1} ---\n{text}"

            pages_text.append(page_block)

        full_text = "\n".join(pages_text).strip()

        if not full_text:
            raise ValueError("No extractable text found in PDF")

        return {
            "text": full_text
        }
