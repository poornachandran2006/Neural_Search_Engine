from pypdf import PdfReader
import re


class PdfLoader:
    """
    Text-only PDF loader.
    Supports PDFs with extractable text.
    OCR is intentionally NOT enabled.
    """

    def load(self, file_path: str) -> dict:
        reader = PdfReader(file_path)
        pages_text = []

        for i, page in enumerate(reader.pages):
            raw_text = page.extract_text()

            if not raw_text:
                continue

            # Preserve structure: Replace excessive spaces but KEEP newlines
            # 1. Replace multiple spaces/tabs with single space
            # 2. Limit newlines to max 2 (paragraph breaks)
            text = re.sub(r'[ \t]+', ' ', raw_text)
            text = re.sub(r'\n\s*\n', '\n\n', text).strip()

            # Explicit page boundary
            page_block = f"\n\n--- PAGE {i + 1} ---\n{text}"
            pages_text.append(page_block)

        full_text = "\n".join(pages_text).strip()

        if not full_text:
            raise ValueError("No extractable text found in PDF")

        return {
            "text": full_text
        }
