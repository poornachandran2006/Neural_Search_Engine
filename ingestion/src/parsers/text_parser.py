# ingestion/src/parsers/text_parser.py

import re


class TextParser:
    """
    Clean and normalize raw text before chunking
    """

    def parse(self, text: str) -> str:
        if not text:
            return ""

        # Normalize line endings
        text = text.replace("\r\n", "\n").replace("\r", "\n")

        # Remove extra blank lines (more than 1 newline)
        text = re.sub(r"\n\s*\n+", "\n\n", text)

        # Replace multiple spaces/tabs with single space
        text = re.sub(r"[ \t]+", " ", text)

        # Strip leading/trailing whitespace
        text = text.strip()

        return text
